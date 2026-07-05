# Feature Specification: Layout Helpers

**Feature Branch**: `006-layout-helpers`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Layout helpers: snap-while-dragging. Aligning nodes by hand is the bottleneck once diagrams grow. Add alignment guides that appear while dragging a node when its edges or center line up with nearby nodes, with a gentle snap. Pure editor ergonomics: nothing new is persisted in the diagram JSON and exports are unaffected — the helper only changes node positions, which are already part of the canonical format."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Snap Guides While Dragging (Priority: P1)

A user drags a node around the canvas. When one of its edges or its center
comes close to lining up with a nearby node's edge or center, a thin guide
line appears showing the alignment and the dragged node snaps gently onto
it. Moving further breaks the snap and the guide disappears.

**Why this priority**: Dragging is how every diagram is laid out; guides fix
misalignment at the moment it happens, with zero extra interactions. This is
the single, highest-frequency win this feature delivers — no multi-selection
or bulk actions required, keeping the feature self-contained to a single
drag interaction.

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

### Edge Cases

- Nodes of very different sizes (image-fitted, manually resized): guide
  detection uses actual rendered bounds, not a guessed/default size.
- Snap guides during fast drags: guides must not make dragging feel sticky
  or laggy; snapping is skippable by moving quickly or holding a modifier.
- A dragged node connected by edges: edges follow the node's new position
  automatically, per existing behavior.
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
- **FR-004**: Guide detection MUST operate on actual rendered node bounds,
  including image-fitted and manually resized nodes.
- **FR-005**: This helper MUST NOT add anything to the canonical diagram
  JSON or any export format; its only effect is updated node positions.

No undo requirement: no other mutation in the app (labels, images, edge
styling, node/edge create-delete) is undoable today, and a snap only
changes `position` — a low-risk, immediately-repeatable action (just drag
again) rather than a destructive one.

No multi-selection requirement: this feature is scoped to a single dragged
node against its neighbors — no align/distribute actions, so no new
selection UI/model is needed (deliberately avoided per user feedback: bulk
multi-select actions were judged not worth the risk of new selection-related
bugs for this feature).

### Key Entities

*(none — this feature persists no new data; node positions are already part
of the canonical diagram JSON)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: While dragging any node near another, guides appear and the
  node snaps within a small, consistent threshold — no manual pixel-nudging
  needed to line two nodes up.
- **SC-002**: Zero changes to the diagram JSON shape: a diagram saved before
  and after this feature (with identical positions) produces identical JSON.
- **SC-003**: Guide rendering and snapping introduce no perceptible drag lag
  on diagrams of 50 nodes.

## Assumptions

- Snap-to-node-alignment is the scope; a background grid snap is out of
  scope for this spec.
- Aligning/distributing multiple selected nodes explicitly (via toolbar or
  shortcut) is explicitly out of scope for this feature — it would require
  a multi-selection UI/model this feature deliberately avoids introducing.
