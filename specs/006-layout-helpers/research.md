# Research: Layout Helpers

## R0: Scope cut — drag-snap only, no align/distribute/multi-select

**Problem**: The original spec had three helpers: (1) snap guides while
dragging a single node, (2) explicit align actions for 2+ selected nodes,
(3) explicit distribute actions for 3+ selected nodes. (2) and (3) both
need a real multi-selection UI/model as a prerequisite — a new surface
(toolbar, enable/disable states tied to selection size, bounding-box math
over an arbitrary node set) with its own edge cases and bug surface,
separate from the single-node-drag interaction (1) already needs.

**Decision**: Cut (2) and (3) entirely. This feature is now just alignment
guides + snap while dragging one node against its neighbors — no
multi-select consumer, no toolbar, no align/distribute functions.

**Rationale**: Per direct feedback: the align/distribute actions were
judged not worth it, and building on top of multi-selection (even though
React Flow's default multi-select already works, see the now-removed
prior R5) was flagged as a real risk of introducing selection-related bugs
for comparatively modest value — guides-while-dragging alone is the
highest-frequency win (per the spec's own Story 1 priority reasoning) and
is fully self-contained to one drag interaction. Smaller, safer, and still
delivers most of the value.

**Alternatives considered**: Keep all three, gated behind more testing —
rejected; the request was to drop them, not de-risk them. Keep align/
distribute but without new UI (e.g. keyboard-only) — rejected, still needs
a multi-selection concept as a prerequisite, which is exactly the added
surface being avoided.

## R1: Guide detection & snap algorithm

**Decision**: For a dragged node's live rect (`x`, `y`, `width`, `height`
from `node.measured`, falling back to `node.width`/`node.height` for a node
not yet measured) and every other node's rect, compare six values on each
axis: `left`/`centerX`/`right` (x-axis) and `top`/`centerY`/`bottom`
(y-axis). A pair matches when `Math.abs(a - b) <= SNAP_THRESHOLD_PX` (screen
pixels, see R3). Among all matches on an axis, keep only the nearest one
(smallest delta) — this is what FR-001's "at most a small number of guides"
and edge case "many nodes ⇒ nearest alignment wins" require. When an axis
has a match, the dragged node's position snaps so that value becomes exact;
each axis (x, y) snaps independently, so a node can snap on both at once.

**Rationale**: Six comparison values per axis (not just centers) covers
"edges or center" per FR-001 with a single O(n) pass over the other nodes;
independent per-axis snap matches how design tools (Figma, Sketch) behave
and keeps the mental model simple — no combined-axis special casing.

**Alternatives considered**: A spatial index (grid/quadtree) for guide
candidates — rejected, over-engineered for the stated scale (SC-005: 50
nodes, comfortably fast as a linear scan). Snapping to *any* matching
alignment rather than only the nearest — rejected, produces guide clutter
the edge cases explicitly rule out.

## R2: No undo

**Problem**: An earlier draft of this spec required align/distribute to be
undoable as one step. That requirement no longer applies (R0 dropped
align/distribute), but the same reasoning extends to the drag-snap that
remains: the app has no existing undo/redo system for any mutation
(labels, images, edge styles, node creation/deletion, or a plain drag) —
adding one just for this feature would be a one-off, inconsistent with the
rest of the editor.

**Decision**: No undo mechanism. A snap only changes `position`; if the
result isn't wanted, dragging the node again immediately fixes it —
nothing is lost or destroyed, so the safety-net argument for undo doesn't
really apply.

**Rationale**: Keeps the feature to pure geometry + a thin wiring hook, no
new interaction-model state. If app-wide undo is ever wanted, it should
cover every mutation consistently, not start as a one-off for this feature.

**Alternatives considered**: A position-only undo stack scoped to this
feature — rejected; real complexity (stack, keybinding, focus-guarding) for
a benefit that's already available by just dragging again. A general
app-wide undo/redo — rejected as unscoped feature creep, no other mutation
in the app currently supports it.

## R3: Snap threshold across zoom levels

**Decision**: Express the snap threshold in **screen pixels** (a constant,
e.g. `SNAP_THRESHOLD_PX = 6`), converting to flow coordinates via the
current viewport zoom (`threshold / zoom`) before comparing node
positions/rects, which are in flow space. Guide line rendering does the
inverse: flow-space guide coordinates are projected to screen space via
React Flow's `useViewport`/`screenToFlowPosition` inverse, same as
`AlignmentGuides` needs anyway to draw an overlay in front of the canvas.

**Rationale**: Directly satisfies the "zoomed far out or in" edge case —
snapping must feel the same physical distance under the cursor regardless
of zoom, which only works if the threshold is defined in screen space and
converted per-frame.

**Alternatives considered**: A fixed flow-space threshold — rejected, would
make snapping trivially easy when zoomed out (large flow-distance covered
by a small mouse movement) and nearly unreachable when zoomed in.

## R4: Modifier key to disable snapping (FR-002)

**Decision**: Holding `Alt`/`Option` during a drag disables guide
computation and snapping for that drag (checked via the drag event's
native modifier flags, e.g. `event.altKey` on the pointer/mouse event
React Flow's `onNodeDrag` forwards) — the node moves exactly with the
cursor, no guides render.

**Rationale**: `Alt` is free in this app (no existing canvas shortcut uses
it) and is the common convention for "disable snap" in design tools.

**Alternatives considered**: `Shift` — rejected, already used by React
Flow's default multi-select-via-click and box-select-via-drag, so
overloading it risks surprising interactions with selection.

## R5: Where guides render

**Decision**: `AlignmentGuides` renders guide lines via React Flow's
`EdgeLabelRenderer` portal — the same flow-space-tracked overlay mechanism
`EdgeToolbar` already uses in this codebase — so guide lines stay pinned to
flow coordinates while panning/zooming mid-drag. It renders nothing while
`useLayoutHelpers` reports no active guides (per FR-003, nothing at rest).

**Rationale**: Reuses the one flow-space overlay mechanism already proven
in this codebase (`EdgeToolbar`) instead of introducing a second one;
`EdgeLabelRenderer` is not edge-specific under the hood — it is just a
portal into the pan/zoom-transformed layer, valid for any flow-space
coordinate, so no new dependency or technique is needed.

**Alternatives considered**: A plain absolutely-positioned DOM/SVG overlay
with manual viewport-transform math — rejected; would duplicate what
`EdgeLabelRenderer` already does correctly and consistently with the rest
of the canvas chrome.
