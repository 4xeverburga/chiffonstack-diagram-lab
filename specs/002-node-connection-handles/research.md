# Research: Node Connection Handles

## R1 — How to let one handle both originate and receive edges

**Decision**: Render one `<Handle type="source">` per side (ids `top`,
`bottom`, `left`, `right`) and set `connectionMode={ConnectionMode.Loose}` on
the editor's `<ReactFlow>`.

**Rationale**: React Flow 12's loose connection mode allows edges to start
and end on any handle regardless of its declared type, which is exactly the
spec's "each point can both originate and receive" (FR-001). One handle per
side keeps the DOM minimal and the ids unambiguous.

**Alternatives considered**:
- *Two stacked handles per side (source + target)* — the classic strict-mode
  workaround. Doubles the DOM, needs z-index juggling so the top handle
  doesn't swallow the other's pointer events, and produces two id namespaces
  (`top-source`/`top-target`) that would leak into the JSON contract. Rejected.
- *Keep strict mode, 2 source + 2 target handles* — would forbid half of the
  16 side combinations (e.g. left→left). Rejected as failing FR-001/SC-001.

## R2 — Where handle choices live on the edge

**Decision**: Use React Flow's native `sourceHandle` / `targetHandle` edge
fields, with handle ids equal to the side names (`top` | `bottom` | `left` |
`right`), and serialize those two fields into the canonical JSON.

**Rationale**: React Flow already records the handle id on the connection
object passed to `onConnect` and re-anchors edges from these fields on
render; inventing a parallel `data.sides` representation would have to be
kept in sync with what the canvas actually renders. Side names as ids make
the JSON human-readable and hand-editable.

**Alternatives considered**: storing sides in `edge.data` — redundant with
the fields React Flow consumes, and a desync risk. Rejected.

## R3 — Legacy default mapping

**Decision**: When an imported edge has no (or an unrecognized)
`sourceHandle`/`targetHandle`, default to `sourceHandle: "right"`,
`targetHandle: "left"`.

**Rationale**: That is byte-for-byte the current behavior — today's
`LabelNode` renders source at `Position.Right` and target at
`Position.Left`, and `computeEdgePaths` hardcodes the same. Old diagrams
therefore re-import looking identical (FR-007, SC-005). Unknown values fall
back rather than throw (FR-008), consistent with `parsePlainEdge`'s existing
variant fallback.

**Alternatives considered**: nearest-side auto-assignment based on node
positions — cleverer but changes how legacy diagrams look on import,
violating the "consistent with previous behavior" requirement. Rejected.

## R4 — Interaction-scoped handle visibility

**Decision**: Handles are always mounted but hidden via editor CSS
(`opacity: 0` + no pointer events at rest is *not* usable for starting a
drag, so instead: small size + `opacity: 0`, revealed by these selectors):

- `.react-flow__node:hover .react-flow__handle` — hover reveal.
- `.react-flow__node.selected .react-flow__handle` — node selected.
- `.lab-canvas.connecting .react-flow__handle` — while a connection drag is
  in progress; the `connecting` class is toggled by `onConnectStart` /
  `onConnectEnd` on the canvas wrapper.
- `.react-flow__node.handles-visible .react-flow__handle` — nodes at either
  end of a selected edge; the `handles-visible` class is computed by the new
  `useHandleVisibility` hook from the current selection.

Handles keep `pointer-events: all` even when transparent so a hover reveal
and an immediate drag-from-handle both work; they are visually 0-opacity,
not `display: none`, so React Flow's edge anchoring is unaffected.

**Rationale**: Pure CSS covers hover/selected with zero JS; the only state
JS must supply is "a drag is happening" (two existing React Flow callbacks)
and "this node touches a selected edge" (a set derivable from state already
held in `App.tsx`). No per-frame work, satisfying the no-lag constraint.

**Alternatives considered**: conditionally mounting handles — unmounting a
handle mid-drag breaks React Flow's connection logic and re-anchors edges;
rejected. Tracking hover in React state — needless re-renders; rejected.

## R5 — Export targets

**Decision**:
- **Component code export**: the generated `DiagramLabelNode` renders the
  same four handles (same ids) hidden by generated CSS, and the generated
  `<ReactFlow>` gets `connectionMode="loose"`; plain edges carry
  `sourceHandle`/`targetHandle` straight from `toPlainDiagram`, so React
  Flow anchors them identically in the consumer app.
- **SVG export**: `computeEdgePaths` reads each edge's sides (with the R3
  default), maps side → anchor point on the node box and side → React Flow
  `Position`, and keeps using `getBezierPath` so exported curves match the
  canvas exactly.

**Rationale**: Constitution I/V — one shared geometry module is already the
single source of path math; extending it (instead of per-target logic) keeps
code and SVG from drifting. Handles in the exported component are required
for edge anchoring even though `nodesConnectable` is false; hiding them in
the generated CSS honors "exports never render connection points".

**Alternatives considered**: omitting handles from the exported component
and letting React Flow fall back to node centers — visibly wrong paths;
rejected.

## R6 — Self-loops and drop-on-node-body

**Decision**: Rely on React Flow defaults: a connection dropped on empty
canvas creates nothing; loose mode + `isValidConnection` rejecting
`source === target` prevents self-loops (spec allows either rejection or
legible rendering — rejection is simpler and keeps scope tight). Dropping on
a node body connects to the nearest handle (React Flow 12
`connectionRadius` behavior).

**Rationale**: Minimal code, matches spec edge cases without inventing
routing for self-loops the product doesn't need.
