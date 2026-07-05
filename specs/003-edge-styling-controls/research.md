# Research: Edge Styling Controls

## R1 — Where thickness and direction live on the edge

**Decision**: Two new optional fields inside `edge.data`, beside the
existing `variant`: `data.thickness: "thin" | "normal" | "thick"` and
`data.direction: "forward" | "reverse"`.

**Rationale**: `edge.data` is already the canonical home for edge styling
(`variant` lives there, `toPlainDiagram` serializes `data` wholesale, and
`parsePlainEdge` already validates it field-by-field with fallbacks). Top-
level custom fields on the React Flow edge would be stripped by
`toPlainDiagram` today and would widen the JSON surface for no benefit.

**Alternatives considered**: encoding thickness as extra variants
(`heat-flow-thick`, …) — multiplies the variant vocabulary 3× and conflates
two orthogonal choices; rejected. Top-level edge fields — inconsistent with
`variant`; rejected.

## R2 — Rendering thickness and direction

**Decision**: Class-driven, from one pure map. New module `edgeStyle.ts`
exports the vocabularies, defaults, the cycle order, and
`THICKNESS_STROKE_WIDTH = { thin: 1.5, thick: 4 }`. **Deliberately no
`normal` entry** (implementation refinement of the original
thin/normal/thick map): today's baseline widths differ per variant *and*
per target (canvas default/dashed render React Flow's hairline, the SVG
export uses 2, heat variants use 2.5 everywhere) — a single `normal` width
would visibly reshape every pre-003 diagram on import, violating
Constitution I. Instead `normal` emits no width override and each
variant's existing baseline keeps rendering; only the opt-in thin/thick
steps carry override rules. Every renderer applies classes
`edge-<variant> edge-w-<thickness>` plus `edge-reverse` when direction is
`reverse`:

- Canvas: `HeatEdge.tsx` builds the className; `App.css` holds the rules.
- Component export: generated `DiagramHeatEdge` builds the same className;
  generated CSS emits one `stroke-width` rule per step (values read from
  the shared map at generation time) and
  `.edge-reverse { animation-direction: reverse; }`.
- SVG export: `computeEdgePaths` passes thickness/direction through on
  `EdgePath`; the SVG `<style>` block gets the same three width rules and
  the same `animation-direction` rule.

**Rationale**: The existing variant treatment is already class-driven in all
three targets, so this follows the established projection pattern; a single
constant map is the only place a pixel value exists, satisfying "closed
vocabulary, no free values" (FR-008) while keeping canvas/exports pixel-
consistent (Constitution I/V). Note today's variant classes hardcode
`stroke-width` (2.5 heat, 2 default/dashed); those declarations move to the
thickness classes so width is controlled in exactly one axis.

**Alternatives considered**: inline `style={{ strokeWidth }}` per edge —
bypasses the class system the SVG export relies on and duplicates values;
rejected. SMIL animation reversal in the SVG — the SVG already animates via
CSS keyframes, `animation-direction: reverse` is one rule; rejected.

## R3 — Reversing the animation without touching endpoints

**Decision**: `direction: "reverse"` only flips the CSS animation
(`animation-direction: reverse` on the dash-offset keyframes). The edge's
`source`/`target`/`sourceHandle`/`targetHandle` are never modified (FR-004).

**Rationale**: The heat-flow animation is a `stroke-dashoffset` tween, so
reversing playback exactly reverses perceived flow. Swapping source/target
instead would change arrowheads, handle attachments, and JSON semantics —
the spec explicitly forbids that.

**Alternatives considered**: negative `stroke-dashoffset` targets or a
second keyframes block — more generated CSS for the same effect; rejected.

## R4 — Floating quick actions at the edge

**Decision**: A new `EdgeToolbar.tsx` rendered from within `HeatEdge.tsx`
via React Flow's `EdgeLabelRenderer`, positioned at the bezier midpoint
(`labelX`/`labelY` already returned by `getBezierPath`), shown only when the
edge is `selected`. Buttons: cycle thickness (always) and reverse flow
(only when `variant === "heat-flow"`). Callbacks (`onCycleThickness`,
`onReverseDirection`) ride into the edge through `edge.data` exactly like
`primaryColor` does today — injected by App into `renderedEdges`, so they
are never part of the persisted state that `toPlainDiagram` serializes.

**Rationale**: `EdgeLabelRenderer` is React Flow's supported way to place
HTML at an edge anchor that tracks pan/zoom for free (spec US3 scenario 2).
The `renderedEdges` injection pattern already exists for `primaryColor`, so
edgeTypes stays a stable module constant and nothing new is invented.
Midpoint placement handles the near-boundary edge case because the toolbar
pans with the viewport and the user can always pan it into reach.

**Alternatives considered**: an App-level overlay computing screen
coordinates from the edge path — reimplements pan/zoom tracking that
`EdgeLabelRenderer` gives for free; rejected. React context for callbacks —
viable, but a second injection mechanism next to the existing `data` pattern
is one pattern too many; rejected.

## R5 — Parsing and backward compatibility

**Decision**: Extend `parsePlainEdge`: `thickness` falls back to `"normal"`
and `direction` to `"forward"` when missing or unrecognized, mirroring the
existing `variant` fallback. `toPlainDiagram` keeps serializing `data`
wholesale, but the parse step whitelists — after import, `edge.data`
contains exactly `{ variant, thickness, direction }`, so re-export
normalizes legacy files to explicit values (same normalization behavior 002
established for handles).

**Rationale**: FR-007's tolerant import is already the module's house style;
whitelisting on parse keeps injected runtime fields (callbacks,
primaryColor) provably out of the JSON.

## R6 — Direction on non-animated edges

**Decision**: `direction` is stored inertly on any edge but only affects
rendering when the variant animates (`heat-flow`). The reverse quick action
and the Inspector toggle are shown only for `heat-flow` edges; a stored
`reverse` on a `dashed` edge is retained harmlessly and reapplies if the
variant changes back (spec edge case).

**Rationale**: Keeping the field variant-independent avoids conditional
serialization rules; hiding the control avoids implying static edges can
animate.

## R7 — Inspector parity

**Decision**: Add thickness chips and (for heat-flow) a direction toggle to
the Inspector's edge pane, reusing the same mutation callbacks as the
toolbar.

**Rationale**: The Inspector is where every other edge property (variant,
delete) already lives; two entry points to the same state costs one chip
row and removes any discoverability question. The quick actions remain the
spec's required path (select + one click).
