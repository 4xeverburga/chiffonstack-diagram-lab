# Feature Specification: Node Connection Handles

**Feature Branch**: `002-node-connection-handles`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Four connection points per node with hover-scoped visibility. Today nodes expose only 2 connection handles; replace this with 4 handles (top, bottom, left, right) so edges can attach on any side. Handles must be invisible by default and only become visible while the user is actively interacting: hovering a node, dragging a new edge, or having the node or a connected edge selected. Edge attachments (which handle an edge connects from/to) must be part of the canonical diagram JSON so they round-trip through export/import, and must be honored by the React Flow code export and the animated SVG export so exported diagrams match the canvas exactly. Existing diagrams saved with 2-handle nodes must load without breaking (attachments default to a sensible side)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect Edges on Any Side (Priority: P1)

A user laying out a topology wants to draw an edge from the left side of one
node to the top of another, because the diagram reads better that way. Every
node offers four connection points — top, bottom, left, right — and the user
drags a connection from any of them to any point on another node.

**Why this priority**: This is the feature's core value. With only two
connection points, many common layouts (vertical stacks, hub-and-spoke,
L-shaped flows) produce edges that overlap nodes or take awkward paths. Four
sides make the canvas usable for real architecture diagrams.

**Independent Test**: Place two nodes on the canvas and create four edges
between them, each pair using a different side combination (e.g. left→top,
bottom→right). Confirm each edge visibly departs and arrives at the chosen
sides.

**Acceptance Scenarios**:

1. **Given** two nodes on the canvas, **When** the user drags a connection
   from the left point of node A to the top point of node B, **Then** an edge
   is created that departs from A's left side and arrives at B's top side.
2. **Given** a node on the canvas, **When** the user inspects its connection
   points during interaction, **Then** exactly four points are available —
   top, bottom, left, and right — and each can both originate and receive
   connections.
3. **Given** an edge attached to specific sides of two nodes, **When** either
   node is moved, **Then** the edge stays attached to the same sides it was
   created on.

---

### User Story 2 - Distraction-Free Canvas (Priority: P2)

A user composing or reviewing a diagram sees a clean canvas: no connection
points are visible on any node. The points appear only while they are
relevant — when the pointer hovers over a node, while a new connection is
being dragged, or while a node or one of its connected edges is selected —
and disappear again when the interaction ends.

**Why this priority**: Doubling the connection points per node would double
the visual noise if they were always visible. The product's output is meant
to look presentation-clean while editing; interaction-scoped visibility keeps
the editing view close to the exported result.

**Independent Test**: Load a diagram with several nodes, confirm no
connection points are visible at rest, then hover a node, select a node,
select an edge, and drag a new connection — confirming points appear in each
case and disappear afterward.

**Acceptance Scenarios**:

1. **Given** a diagram at rest (no hover, no selection, no drag), **When**
   the user looks at the canvas, **Then** no connection points are visible on
   any node.
2. **Given** a diagram at rest, **When** the user hovers the pointer over a
   node, **Then** that node's four connection points become visible, and
   **When** the pointer leaves, **Then** they disappear.
3. **Given** a node is selected, **When** the user looks at that node,
   **Then** its four connection points are visible while the selection lasts.
4. **Given** an edge is selected, **When** the user looks at the two nodes it
   connects, **Then** both nodes' connection points are visible while the
   selection lasts.
5. **Given** the user is dragging a new connection, **When** the drag is in
   progress, **Then** connection points on candidate target nodes are visible
   so the user can see where the edge may land.

---

### User Story 3 - Attachments Survive Export and Import (Priority: P1)

A user builds a diagram with edges attached to specific node sides, exports
it (diagram JSON, component code, or animated image), and later re-imports
the JSON. Every edge still connects to the exact sides the user chose, in the
editor and in every export format.

**Why this priority**: Export is the product. A side choice that silently
changes after a round trip or renders differently in an export would make the
feature untrustworthy; shipping side-selection without persistence would be
worse than not shipping it.

**Independent Test**: Build a diagram using at least three distinct side
combinations, export the diagram JSON, clear the canvas, re-import, and
confirm every edge is attached to its original sides. Export the component
code and the animated image and confirm the rendered edges depart/arrive on
the same sides as on the canvas.

**Acceptance Scenarios**:

1. **Given** a diagram whose edges use specific side attachments, **When**
   the user exports the diagram JSON and re-imports it, **Then** every edge
   is attached to the same sides as before the export.
2. **Given** a diagram whose edges use specific side attachments, **When**
   the user exports component code and renders it in a host app, **Then**
   every edge departs and arrives on the same sides as on the canvas.
3. **Given** a diagram whose edges use specific side attachments, **When**
   the user exports the animated image, **Then** every edge is drawn
   departing and arriving on the same sides as on the canvas.

---

### User Story 4 - Old Diagrams Keep Working (Priority: P2)

A user who saved diagram JSON before this feature existed pastes it back into
the editor. The diagram loads without errors and every edge attaches to a
sensible side of its nodes, ready to be re-attached to other sides if the
user wishes.

**Why this priority**: The diagram JSON is the canonical, versionable source
users are told they own. Breaking previously exported JSON would violate the
product's round-trip promise.

**Independent Test**: Take a diagram JSON exported before this feature (edges
carry no side information), import it, and confirm it loads cleanly with all
edges attached to consistent, sensible sides matching the previous two-point
behavior.

**Acceptance Scenarios**:

1. **Given** diagram JSON created before side attachments existed, **When**
   the user imports it, **Then** the diagram loads without error and every
   edge is attached to a sensible default side.
2. **Given** an imported pre-feature diagram, **When** the user re-exports
   the JSON without editing, **Then** the resulting JSON now carries explicit
   side attachments for every edge.

---

### Edge Cases

- Both endpoints of an edge attach to the same node (self-loop): either the
  connection is rejected with clear feedback, or it renders legibly — it must
  not produce a corrupt or invisible edge.
- Multiple edges attach to the same side of the same node: all remain visible
  and selectable; overlapping is acceptable, breakage is not.
- A connection drag is released over empty canvas: no edge is created and no
  error appears.
- A connection drag is released over a node body rather than a specific
  point: the edge attaches to the nearest sensible side rather than failing.
- Imported JSON carries an unknown side value (hand-edited file): the import
  falls back to the default side rather than rejecting the whole diagram.
- A node with an attached image or manual resize: the four points sit on the
  actual rendered bounds, not on stale default dimensions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every node MUST expose exactly four connection points — top,
  bottom, left, and right — each able to both originate and receive edges.
- **FR-002**: Connection points MUST be hidden by default and visible only
  while the user hovers the node, drags a new connection, or has the node or
  one of its connected edges selected.
- **FR-003**: An edge MUST record which side of the source node and which
  side of the target node it attaches to, and MUST keep those attachments
  when nodes are moved or resized.
- **FR-004**: The canonical diagram JSON MUST include each edge's side
  attachments, and importing that JSON MUST restore the exact attachments.
- **FR-005**: The component-code export MUST reproduce each edge's side
  attachments so the rendered diagram matches the canvas.
- **FR-006**: The animated image export MUST draw each edge departing and
  arriving on the sides chosen on the canvas.
- **FR-007**: Diagram JSON that predates side attachments MUST import without
  error, with each edge assigned a default side consistent with the previous
  two-point behavior.
- **FR-008**: Imported JSON containing an unrecognized side value MUST fall
  back to the default side for that endpoint instead of failing the import.
- **FR-009**: Connection points MUST be positioned on the node's actual
  rendered bounds, including nodes with images or manual resizes.

### Key Entities

- **Connection point (handle)**: One of four fixed anchor positions on a
  node's perimeter (top, bottom, left, right). Not persisted per se — its
  existence is implied by the node; only its *selection* by an edge is data.
- **Edge attachment**: The pair of side choices an edge carries — source side
  and target side. Part of the canonical diagram JSON; the unit that must
  round-trip through every export format.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create an edge between any side of one node and any
  side of another — all 16 side combinations produce a correctly attached
  edge.
- **SC-002**: With no active interaction, zero connection points are visible
  on the canvas regardless of diagram size.
- **SC-003**: 100% of edges retain their chosen sides after a JSON
  export/import round trip.
- **SC-004**: Rendered exports (component code and animated image) attach
  100% of edges to the same sides shown on the canvas.
- **SC-005**: 100% of pre-feature diagram JSON files import successfully with
  no user intervention.

## Assumptions

- The default side for legacy edges matches the two connection points nodes
  have today, so imported old diagrams look identical to how they were saved.
- Side attachments are chosen implicitly by which point the user drags
  from/to; there is no separate property panel for editing sides after
  creation (re-dragging the edge endpoint is the editing mechanism).
- Edge routing between the chosen sides continues to use the existing edge
  path style; this feature changes *where* edges attach, not *how* they curve.
- Connection-point visibility rules apply to the editor canvas only; exports
  never render connection points.
