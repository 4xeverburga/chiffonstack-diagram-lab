# Phase 0 Research: Export Suite

All Technical Context unknowns resolved. Decisions below.

## 1. React Flow component export — file shape

**Decision**: Generate **two files**: `Diagram.tsx` and `diagram.css`. The
`.tsx` embeds the serialized nodes/edges as typed constants, defines local
`LabelNode` and `HeatEdge` components (self-contained re-implementations of
the lab's renderers, tokens interpolated as CSS custom properties on the
wrapper), and renders a locked-down `<ReactFlow>` (pan/zoom on; node dragging,
connecting, and selection off). The `.css` carries the node/edge/keyframe
rules mirrored from `App.css`, namespaced under a `.chiffon-diagram` root
class. The only import consumers need is `@xyflow/react` (+ its `style.css`).
For the clipboard "Export code" action, the two files are concatenated in one
snippet with `// ─── Diagram.tsx` / `/* ─── diagram.css */` file markers; the
bundle (P2) ships them as real files.

**Rationale**: Two files keep the CSS editable and match how consumers
structure components; embedding data as constants (not a JSON import) keeps
the export a single copy-paste unit. Re-implementing the two small renderers
instead of publishing a shared npm package keeps the project
dependency-free-for-consumers beyond `@xyflow/react` (constitution III) —
at ~100 lines of generated component code, duplication is acceptable and the
generator is the single source.

**Alternatives considered**: (a) publish `@chiffonstack/diagram-runtime` npm
package — rejected: adds a release pipeline and version skew for marginal
dedup; (b) single `.tsx` with CSS-in-JS — rejected: style injection at
runtime complicates SSR (Astro landing page is a target consumer) and fights
the "reads like the consumer's code" goal; (c) iframe/embed — banned by
PRODUCT.md anti-references.

## 2. Interactivity level of exported component

**Decision**: `panOnDrag`, `zoomOnScroll`/`zoomOnPinch`, `fitView` enabled;
`nodesDraggable={false}`, `nodesConnectable={false}`,
`elementsSelectable={false}`; `Background`/`Controls`/`MiniMap` omitted;
`preventScrolling={false}` so page scroll isn't hijacked. `proOptions.hideAttribution`
is **not** set (React Flow attribution stays, per its license terms for free use).

**Rationale**: The spec promises "live" (animation + pan/zoom), not an
editor. Display-only defaults avoid consumers accidentally shipping an
editable diagram; page-scroll capture is the #1 embed complaint.

## 3. Animated SVG — animation technique

**Decision**: CSS keyframes inside `<style>` within the SVG, animating
`stroke-dashoffset` on `.edge-heat-flow` paths — a direct port of App.css's
`@keyframes heat-flow`. Include a `@media (prefers-reduced-motion: reduce)`
rule disabling the animation (as the canvas already does). Static-frame
completeness: the animated path is a fully drawn dashed stroke at time zero,
so hosts that don't run CSS animation (design-tool imports) show the complete
static frame with no extra work.

**Rationale**: CSS-in-SVG animates in `<img>` in all evergreen browsers, is
identical to the canvas implementation (fidelity by construction), and
respects reduced-motion. SMIL (`<animate>`) also works in `<img>` but is a
second implementation to keep in sync and has no advantage here.

**Alternatives considered**: SMIL (rejected: parallel implementation,
deprecated-adjacent); JS-in-SVG (banned: constitution I zero-script);
animated raster (GIF/WebP/video — rejected in constitution v1.2.0).

## 4. Edge geometry outside React Flow

**Decision**: Extract a shared `exportGeometry.ts` used by both visual
exports: node sizing (the existing label-width heuristic + manual-resize
override from `exportCode.ts`) and edge paths via `getBezierPath` from
`@xyflow/react` (re-exported from `@xyflow/system`), computing
source/target handle positions from node boxes (right-center → left-center,
matching the canvas's default handle placement in `LabelNode`).

**Rationale**: The canvas draws bezier edges (`HeatEdge` uses
`getBezierPath`); exports must match (constitution I). Reusing React Flow's
own path function guarantees identical curves; the editor already has the
dependency, and generated SVG/code contains only the resulting path strings —
consumers of the SVG need nothing.

## 5. Zip generation (agent bundle)

**Decision**: `fflate` (`zipSync` with in-memory `Uint8Array` entries),
triggered by a Blob + temporary `<a download="diagram-bundle.zip">` click.

**Rationale**: ~8 KB, zero dependencies, synchronous API fits the
deterministic-generator model; JSZip is 10× larger and Promise-based for no
benefit at these sizes. Anchor-download avoids the clipboard permission
issues the current copy buttons can hit and is the natural UX for a zip.

**Alternatives considered**: JSZip (size, async); `showSaveFilePicker`
(Chromium-only); hand-rolled zip writer (worst legibility per constitution IV).

## 6. Bundle contents & image assets

**Decision**: `diagram-bundle.zip` contains `Diagram.tsx`, `diagram.css`,
`diagram.json`, `prompt.md`, and `assets/node-<id>.<ext>` files decoded from
each node's data URI. The component code and diagram.json keep the **inline
data URIs** (self-contained, render-anywhere); the `assets/` folder is a
convenience duplicate so an agent (or human) can move images into the
consumer's asset pipeline and swap the references, as `prompt.md` explains.

**Rationale**: Inline-first satisfies SC-005/constitution I (no external
references); the duplicate files serve the agent workflow without making the
component depend on them. Extension inferred from the data URI MIME type.

## 7. prompt.md shape

**Decision**: Generated by `promptTemplate.ts` from `(tokens, file list,
node/edge counts)`. Sections: what this bundle is; file inventory; the
4-token contract (name → what it controls → current value, and where each is
interpolated); integration steps (install `@xyflow/react`, copy files, import,
sizing container); optional asset-pipeline migration; verification checklist
(animation plays, pan/zoom works, fonts/colors match). Written to be executed
by a coding agent without further questions (SC-003).

## 8. Escaping rules (FR-011)

**Decision**: Per-target escapers, unit-tested: SVG/HTML text → existing
`escapeHtml` (extended with `"` → `&quot;` for attribute positions); values
interpolated into generated TS code → `JSON.stringify` (single source of
string-literal escaping); CSS font-family values → quoted, with `"` and `\`
escaped, and a generic fallback appended (`, sans-serif` / `, monospace`
preserved from token value if present).

## 9. Image upload changes (P4)

**Decision**: New `imageUpload.ts` exporting the accept list
(`image/png,image/svg+xml,image/jpeg`), a `readImageFile(file: File)`
returning `{ dataUri, byteSize }`, and `IMAGE_SIZE_WARNING_BYTES = 500_000`.
Inspector shows a persistent, dismissable inline warning under the image
preview when `byteSize` exceeds the threshold ("Large image (X KB): this is
embedded in the diagram JSON and every export — consider compressing").
Upload never blocks (FR-008).

**Rationale**: 500 KB pre-encoding ≈ 670 KB embedded — noticeable but not
pathological in a shared JSON; threshold is a named constant, trivially tuned.

## 10. Empty-canvas handling (FR-009)

**Decision**: Every export action guards `nodes.length === 0` and surfaces
the existing status-label pattern (`'Add nodes first'` state on the button,
same 1.8 s reset) instead of producing output. Generators themselves throw
on empty input (explicit contract) — the UI layer catches.

## 11. Testing approach

**Decision**: Vitest, dev-dependency, `test/lab/*.test.ts`, targeting the
pure generators only (component code, SVG, bundle manifest, prompt, escaping,
geometry). Fixture = one "kitchen-sink" diagram exercising every capability
(all node kinds, image node, resized node, all edge variants). Assertions on
structural invariants (contains keyframes, no un-escaped label text, data
URIs present, deterministic repeat-call equality) rather than full golden
files, to keep tests legible.

**Note on lock file**: adding `fflate`/`vitest` must follow CLAUDE.md's
npm-10 lock-file regeneration rule if this repo adopts the same Cloudflare
deployment; verify before first `npm install`.
