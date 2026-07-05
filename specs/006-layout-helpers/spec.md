# Feature Specification: Layout Helpers

**Feature Branch**: `002-node-connection-handles`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Layout helpers: snap, align, and distribute. Aligning nodes by hand is the bottleneck once diagrams grow. Add alignment guides that appear while dragging a node when its edges or center line up with nearby nodes (with a gentle snap), plus explicit align (left/center/right, top/middle/bottom) and distribute (horizontal/vertical spacing) actions for multi-selected nodes. Pure editor ergonomics: nothing new is persisted in the diagram JSON and exports are unaffected — the helpers only change node positions, which are already part of the canonical format."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Snap Guides While Dragging (Priority: P1)

A user drags a node around the canvas. When one of its edges or its center
comes close to lining up with a nearby node's edge or center, a thin guide
line appears showing the alignment and the dragged node snaps gently onto
it. Moving further breaks the snap and the guide disappears.

**Why this priority**: Dragging is how every diagram is laid out; guides fix
misalignment at the moment it happens, with zero extra interactions. This is
the highest-frequency win of the three helpers.

**Independent Test**: Place two nodes, drag a third slowly past alignment
with each — confirm guides appear at edge and center alignments, the node
snaps onto the guide, and dragging beyond a threshold releases the snap.

**Acceptance Scenarios**:

1. **Given** a node being dragged near another node's horizontal or vertical
   alignment (edge or center), **When** the alignment comes within snapping
   distance, **Then** a guide line appears and the dragged node snaps to the
   alignment.
2. **Given** a snapped node still being dragged, **When** the user moves it
   past the snap threshold, **Then** the snap releases and the guide
   disappears.
3. **Given** a diagram at rest (no drag), **When** the user views the
   canvas, **Then** no guide lines are visible.
4. **Given** many nodes near the dragged node, **When** several alignments
   are simultaneously possible, **Then** the nearest alignment wins and at
   most a small number of guides show at once — never a lattice of lines.

---

### User Story 2 - Align Selected Nodes (Priority: P2)

A user multi-selects several nodes and applies an alignment action: align
left, horizontal center, right, top, vertical middle, or bottom. The
selected nodes line up on the chosen axis in one step.

**Why this priority**: Fixes existing misalignment in bulk — the complement
to guides, which prevent it during drag. Requires multi-selection, making it
a distinct interaction from Story 1.

**Independent Test**: Scatter four nodes, select them, apply each of the six
alignments in turn, and confirm the nodes line up correctly each time.

**Acceptance Scenarios**:

1. **Given** three or more selected nodes at scattered positions, **When**
   the user applies "align left", **Then** all selected nodes' left edges
   share one vertical line; the equivalents hold for the other five
   alignments.
2. **Given** a single selected node or none, **When** the user looks for
   align actions, **Then** they are unavailable or clearly inapplicable.
3. **Given** an alignment was just applied, **When** the user invokes undo,
   **Then** all affected nodes return to their prior positions in one step.

---

### User Story 3 - Distribute Selected Nodes (Priority: P3)

A user selects three or more nodes and applies "distribute horizontally" or
"distribute vertically". The nodes spread out so the spacing between
adjacent nodes is equal, keeping the outermost nodes in place.

**Why this priority**: Even spacing is the finishing touch after alignment;
valuable for presentation-quality output but needed less often than align.

**Independent Test**: Place three nodes with uneven gaps on one axis, apply
distribute on that axis, and confirm the middle node moves so both gaps are
equal while the outer nodes stay put.

**Acceptance Scenarios**:

1. **Given** three or more selected nodes with uneven spacing along an axis,
   **When** the user applies distribute on that axis, **Then** the gaps
   between adjacent nodes become equal and the outermost nodes do not move.
2. **Given** fewer than three selected nodes, **When** the user looks for
   distribute actions, **Then** they are unavailable or clearly
   inapplicable.
3. **Given** a distribution was just applied, **When** the user invokes
   undo, **Then** all affected nodes return to their prior positions in one
   step.

---

### Edge Cases

- Nodes of very different sizes (image-fitted, manually resized): alignment
  uses actual rendered bounds, and distribution equalizes the gaps between
  nodes, not their center distances.
- Overlapping nodes in a distribute selection: the result is a valid equal
  spacing; resolving overlaps is not the helper's job, but it must not
  error.
- Snap guides during fast drags: guides must not make dragging feel sticky
  or laggy; snapping is skippable by moving quickly or holding a modifier.
- Align/distribute on nodes connected by edges: edges follow their nodes'
  new positions automatically, per existing behavior.
- Zoomed far out or in: snap distance behaves consistently relative to the
  screen, so snapping doesn't become impossible or overwhelming at extreme
  zoom.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: While a node is dragged, the editor MUST show alignment guides
  when the node's edges or center align with a nearby node's edges or
  center, and MUST snap the node onto the alignment within a small
  threshold.
- **FR-002**: Snapping MUST be escapable: dragging past the threshold
  releases it, and a modifier key MUST temporarily disable snapping during a
  drag.
- **FR-003**: Guides MUST be visible only during a drag that produces an
  alignment; none may remain visible at rest.
- **FR-004**: With two or more nodes selected, the user MUST be able to
  apply six alignment actions: left, horizontal center, right, top,
  vertical middle, bottom.
- **FR-005**: With three or more nodes selected, the user MUST be able to
  apply horizontal and vertical distribution that equalizes gaps between
  adjacent nodes while keeping the outermost nodes fixed.
- **FR-006**: Align and distribute MUST operate on actual rendered node
  bounds, including image-fitted and manually resized nodes.
- **FR-007**: Every align or distribute action MUST be undoable as a single
  step.
- **FR-008**: Layout helpers MUST NOT add anything to the canonical diagram
  JSON or any export format; their only effect is updated node positions.

### Key Entities

*(none — this feature persists no new data; node positions are already part
of the canonical diagram JSON)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can align any set of selected nodes on any of the six
  axes in a single action.
- **SC-002**: A user can equalize spacing across a row or column of nodes in
  a single action.
- **SC-003**: With helpers available, laying out a 10-node diagram with
  aligned rows/columns takes under 2 minutes without manual coordinate
  nudging.
- **SC-004**: Zero changes to the diagram JSON shape: a diagram saved before
  and after this feature (with identical positions) produces identical JSON.
- **SC-005**: Guide rendering and snapping introduce no perceptible drag lag
  on diagrams of 50 nodes.

## Assumptions

- Multi-node selection (marquee or shift-click) either already exists or is
  in scope for this feature as the minimal enabler for align/distribute; no
  broader selection model is introduced.
- Where the align/distribute actions live (toolbar, context menu, shortcut)
  is a design decision during implementation; the spec constrains only the
  single-action requirement.
- Snap-to-node-alignment is the scope; a background grid snap is out of
  scope for this spec.
- Distribution equalizes edge-to-edge gaps (not center spacing), which is
  what looks even with mixed node sizes.
