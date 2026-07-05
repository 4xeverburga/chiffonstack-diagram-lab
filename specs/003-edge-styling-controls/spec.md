# Feature Specification: Edge Styling Controls

**Feature Branch**: `002-node-connection-handles`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Edge personalization: thickness and animation direction. Edges gain a thickness property expressed as a closed vocabulary of steps (thin, normal, thick) — not free pixel values — consistent with the constitution's variant-vocabulary principle. When an edge is selected, small floating quick-action buttons appear next to it: one reverses the direction of the edge's flow animation (heat-flow), one cycles the thickness through the available steps. Thickness and animation direction are part of the canonical diagram JSON and must round-trip through export/import and be honored by the React Flow code export and the animated SVG export. Existing diagrams without these properties load with defaults (normal thickness, forward direction)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Adjust Edge Thickness (Priority: P1)

A user wants some connections in their diagram to carry more visual weight
than others — a primary data path drawn heavier than a side channel. They
select an edge and use a quick action next to it to cycle its thickness
through three steps: thin, normal, thick.

**Why this priority**: Visual hierarchy between connections is the most
requested styling gap; without it every edge reads as equally important and
diagrams of real systems look flat.

**Independent Test**: Create three edges, set one to each thickness step via
the quick action, and confirm the three render visibly different and keep
their thickness after deselection.

**Acceptance Scenarios**:

1. **Given** a selected edge at normal thickness, **When** the user activates
   the thickness quick action, **Then** the edge becomes thick, and repeated
   activations cycle thin → normal → thick → thin.
2. **Given** an edge set to a non-default thickness, **When** the user
   deselects it and continues editing elsewhere, **Then** the edge keeps its
   chosen thickness.
3. **Given** edges of different thicknesses, **When** the user views the
   canvas, **Then** the three steps are visually distinguishable at default
   zoom.

---

### User Story 2 - Reverse Flow Animation (Priority: P1)

A user has drawn a heat-flow edge but the animation travels the wrong way for
the story the diagram tells (e.g. a response path, not a request path). They
select the edge and hit a quick action that reverses the animation direction
— without deleting and redrawing the edge.

**Why this priority**: Today the only way to change flow direction is to
delete the edge and redraw it backwards, which also swaps the logical
endpoints. Direction is a storytelling choice and needs a one-click control.

**Independent Test**: Create a heat-flow edge, observe the animation
direction, activate the reverse quick action, and confirm the animation now
travels the opposite way while the edge's endpoints stay unchanged.

**Acceptance Scenarios**:

1. **Given** a selected heat-flow edge animating from source to target,
   **When** the user activates the reverse quick action, **Then** the
   animation travels target to source while the edge remains attached to the
   same nodes and sides.
2. **Given** a reversed edge, **When** the user activates the reverse action
   again, **Then** the animation returns to the original direction.
3. **Given** an edge without flow animation, **When** the user selects it,
   **Then** the reverse action is absent or clearly inapplicable — activating
   nothing breaks.

---

### User Story 3 - Quick Actions Appear Only on Selection (Priority: P2)

A user editing a diagram sees a clean canvas; no edge controls are visible.
When they select an edge, its quick-action buttons appear adjacent to the
edge, positioned so they don't cover the edge or nearby nodes. Deselecting
hides them.

**Why this priority**: The controls' value depends on not polluting the
canvas. Persistent per-edge buttons would multiply visual noise across large
diagrams.

**Independent Test**: Load a diagram with many edges, confirm no buttons are
visible at rest, select one edge, confirm its buttons appear near it, select
a different edge, confirm the buttons move, deselect, confirm they disappear.

**Acceptance Scenarios**:

1. **Given** no edge is selected, **When** the user views the canvas,
   **Then** no edge quick-action buttons are visible.
2. **Given** an edge is selected, **When** the buttons appear, **Then** they
   are positioned adjacent to that edge and remain usable at any pan/zoom
   level.
3. **Given** an edge is selected with its buttons visible, **When** the user
   selects a different edge or clicks empty canvas, **Then** the buttons
   follow the new selection or disappear.

---

### User Story 4 - Styling Survives Export and Import (Priority: P1)

A user sets edge thicknesses and animation directions, exports the diagram
(JSON, component code, animated image), and re-imports the JSON later. Every
edge keeps its thickness and direction in the editor and in every export
format.

**Why this priority**: Export is the product; a styling property that doesn't
survive the trip out is a defect, not a feature.

**Independent Test**: Build a diagram with all three thicknesses and at least
one reversed heat-flow edge. Round-trip the JSON and confirm all properties
restore. Render the component-code export and the animated image and confirm
thickness and animation direction match the canvas.

**Acceptance Scenarios**:

1. **Given** edges with non-default thickness and direction, **When** the
   JSON is exported and re-imported, **Then** every edge restores its exact
   thickness and direction.
2. **Given** the same diagram, **When** component code is exported and
   rendered in a host app, **Then** thickness steps and animation directions
   match the canvas.
3. **Given** the same diagram, **When** the animated image is exported,
   **Then** edge weights and animation directions match the canvas.
4. **Given** diagram JSON created before these properties existed, **When**
   it is imported, **Then** it loads without error with normal thickness and
   forward direction on every edge.

---

### Edge Cases

- Quick-action buttons near the canvas boundary: buttons must remain
  reachable (repositioned inward) rather than clipped offscreen.
- A very short edge between two close nodes: buttons must not cover the edge
  entirely; usability wins over exact adjacency.
- Reversing direction on an edge whose variant is later changed to
  non-animated: the stored direction is retained harmlessly and reapplies if
  the edge becomes animated again.
- Imported JSON with an unknown thickness value: falls back to normal
  thickness rather than rejecting the diagram.
- Multiple edges selected (if multi-select exists): quick actions either
  apply to all selected edges consistently or appear only for single
  selection — no ambiguous partial application.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every edge MUST carry a thickness property with exactly three
  allowed values — thin, normal, thick — defaulting to normal.
- **FR-002**: Every flow-animated edge MUST carry an animation-direction
  property — forward or reversed — defaulting to forward.
- **FR-003**: Selecting an edge MUST reveal quick-action buttons adjacent to
  it: one cycling thickness, one reversing animation direction (the latter
  only when the edge has flow animation). Deselecting MUST hide them.
- **FR-004**: Reversing animation direction MUST NOT change the edge's
  logical endpoints or side attachments.
- **FR-005**: The canonical diagram JSON MUST include thickness and animation
  direction, and importing MUST restore them exactly.
- **FR-006**: The component-code export and the animated image export MUST
  render each edge's thickness step and animation direction as shown on the
  canvas.
- **FR-007**: Diagram JSON lacking these properties MUST import with defaults
  (normal, forward) and no errors; unknown values MUST fall back to defaults.
- **FR-008**: Thickness MUST be expressed only as the closed vocabulary of
  steps; no free-form numeric thickness is exposed to the user or the JSON.

### Key Entities

- **Edge thickness**: A three-step closed vocabulary (thin, normal, thick)
  carried by every edge; part of the canonical JSON.
- **Animation direction**: A binary property (forward, reversed) meaningful
  for flow-animated edges; carried in the canonical JSON; independent of the
  edge's logical source/target.
- **Edge quick actions**: Ephemeral selection-scoped controls; pure UI, never
  persisted or exported.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can change an edge's thickness or reverse its animation
  in 2 interactions or fewer (select + one click).
- **SC-002**: With no edge selected, zero edge-control buttons are visible
  regardless of diagram size.
- **SC-003**: 100% of thickness and direction values survive a JSON
  export/import round trip.
- **SC-004**: Rendered exports (component code and animated image) match the
  canvas thickness and direction for 100% of edges.
- **SC-005**: 100% of pre-feature diagram JSON files import successfully with
  default styling and no user intervention.

## Assumptions

- Three thickness steps are sufficient; per the project constitution, styling
  needs are met with a closed variant vocabulary, not free values or per-edge
  style panels.
- The thickness quick action cycles through the steps rather than opening a
  picker, keeping the interaction one click.
- Animation direction only has a visible effect on flow-animated edge
  variants; static edges store nothing direction-related or store it inertly.
- Exact visual weights of thin/normal/thick are a design decision made during
  implementation; the spec constrains only that they be clearly
  distinguishable.
- This spec assumes edge side-attachments (spec 002) may land first; reversal
  must preserve attachments, but this feature does not depend on 002 to ship.
