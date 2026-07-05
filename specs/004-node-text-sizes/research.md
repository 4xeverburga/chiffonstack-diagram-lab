# Research: Node Text Sizes

## R1 — "Per text element" in today's node model

**Decision**: The property is `data.labelSize` on the node. A node currently
has exactly one text element — its label — so per-element sizing and
per-node sizing coincide today. The field name is scoped to the label so a
future second text element (e.g. a caption) gets its own field instead of
overloading this one.

**Rationale**: The spec allows mixing sizes "per text element"; with one
element per node this is satisfied without inventing a text-elements array
the product doesn't have. No speculative generality (Constitution IV).

**Alternatives considered**: a `data.texts[]` array with per-entry size —
redesigns the node data model for a hypothetical; rejected.

## R2 — The size map and where pixel values live

**Decision**: New pure module `textSizes.ts`:

```
TEXT_SIZES = ["small", "normal", "large"]           // + type, default "normal"
TEXT_SIZE_METRICS = {
  small:  { fontPx: 11, charWidth: 6.5, nodeHeight: 36, labelBand: 18 },
  normal: { fontPx: 13, charWidth: 7.5, nodeHeight: 40, labelBand: 20 },
  large:  { fontPx: 16, charWidth: 9.2, nodeHeight: 48, labelBand: 24 },
}
```

`exportGeometry.ts` replaces its hardcoded `NODE_HEIGHT`, `CHAR_WIDTH`, and
`LABEL_BAND_HEIGHT` constants with lookups keyed by the node's size, so
auto-width, auto-height, and the SVG label band all scale with the step.
Canvas CSS, generated component CSS, and the SVG `<style>` block each emit
`font-size` rules for `.node-label-small` / `.node-label-large` (normal
stays the base rule), with values taken from this map at generation time.

**Rationale**: The `normal` row is byte-identical to today's constants
(13px font, 7.5 char width, 40 node height, 20 label band), so legacy
diagrams render unchanged (FR-006, SC-004). One map keeps canvas, geometry
heuristic, and both visual exports in lockstep (Constitution I/V); the
exact px values are the "design decision during implementation" the spec
anticipated, chosen so the three steps are clearly distinguishable at
default zoom.

**Alternatives considered**: CSS `em` scaling with a single base — the
export geometry math needs concrete numbers for width estimation, so a
purely relative scheme still requires a map; rejected as indirection
without benefit. Measuring rendered text (canvas/DOM measure) — breaks the
pure-function rule for export geometry and introduces nondeterminism;
rejected.

## R3 — Rendering path

**Decision**: `LabelNode.tsx` reads `data.labelSize` (fallback `normal`)
and adds `node-label-<size>` to the existing `.node-label` span. The
generated component's `DiagramLabelNode` does the same. The SVG export adds
the class to each `<text>` element. All steps inherit
`font-family: var(--token-body-font)` from the existing base rule — the
size classes set only `font-size`.

**Rationale**: Minimal diff on the established class-driven pattern; FR-002
(body font everywhere, no heading style) holds by construction because the
size classes cannot override family.

## R4 — Auto-size vs manual size interaction

**Decision**: No new logic. Auto-sized nodes recompute width/height from
the per-step metrics (they grow/shrink on size change); nodes with
persisted `width`/`height` (manual resize, and 005's image fit later) keep
their dimensions — text wraps/ellipsizes inside per existing node CSS
(`text-overflow: ellipsis` on the canvas/component; SVG text centered in
its band).

**Rationale**: FR-007 maps exactly onto the existing width/height
semantics from 001; the ellipsis treatment is today's controlled-truncation
behavior, satisfying the "never silently overflows" edge case.

## R5 — Serialization and backward compatibility

**Decision**: `parsePlainNode` gains `labelSize` with fallback to
`"normal"` on missing or unrecognized values (never throws);
`toPlainDiagram` serializes it from `data`. After import, re-export emits
the explicit value (normalization, consistent with 002/003).

**Rationale**: House pattern (`variant`, handles, 003's fields). FR-006.

## R6 — Where the control lives

**Decision**: Size chips (small / normal / large) in the Inspector's node
pane, next to the existing style chips — same chip component and callback
pattern as node kind. No floating quick action for nodes.

**Rationale**: Select node + click chip = 2 interactions (FR-003/SC-001).
Node selection already opens the Inspector, unlike edges where 003 needed
an on-canvas affordance; adding a node toolbar would duplicate an existing
surface.
