# Feature Specification: Node Text Sizes

**Feature Branch**: `002-node-connection-handles`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Text size steps for node text. There is no header/body distinction on a node — all node text is body text rendered with the body font token. Today all node text renders at a single size; add a closed vocabulary of size steps (small, normal, large) selectable per text element, so a node's main label can be visually bigger than its caption without introducing a heading concept. Size choices are part of the canonical diagram JSON, round-trip through export/import, and are honored by the React Flow code export and the animated SVG export. Existing diagrams load with the normal size."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set a Text Element's Size (Priority: P1)

A user labels a node with a service name and wants it to stand out from the
smaller descriptive text on the same node. They select the text and choose
one of three sizes — small, normal, large. All text keeps the same body font;
only the size changes.

**Why this priority**: This is the entire feature: today every piece of node
text renders at one size, so diagrams cannot express which label is the name
and which is the annotation.

**Independent Test**: Create a node with two text elements, set one to large
and one to small, and confirm they render at visibly different sizes using
the same font, and keep their sizes after deselection.

**Acceptance Scenarios**:

1. **Given** a node text element at normal size, **When** the user selects a
   different size step, **Then** the text re-renders at that size
   immediately.
2. **Given** text elements at small, normal, and large on the canvas,
   **When** the user views them at default zoom, **Then** the three steps
   are clearly distinguishable and all use the body font.
3. **Given** a text element with a chosen size, **When** the user edits its
   content, **Then** the size choice is retained.

---

### User Story 2 - Sizes Survive Export and Import (Priority: P1)

A user builds a diagram mixing all three text sizes, exports it (JSON,
component code, animated image), and re-imports the JSON later. Every text
element keeps its chosen size in the editor and in every export format.

**Why this priority**: Export is the product; a size choice that renders
differently in an export than on the canvas breaks the pixel-faithful
promise.

**Independent Test**: Build a diagram using all three sizes, round-trip the
JSON, and confirm all sizes restore. Render the component-code export and
the animated image and confirm text sizes match the canvas proportionally.

**Acceptance Scenarios**:

1. **Given** a diagram with mixed text sizes, **When** the JSON is exported
   and re-imported, **Then** every text element restores its exact size step.
2. **Given** the same diagram, **When** component code is exported and
   rendered in a host app, **Then** the relative text sizes match the canvas.
3. **Given** the same diagram, **When** the animated image is exported,
   **Then** the text sizes match the canvas rendering.
4. **Given** diagram JSON created before size steps existed, **When** it is
   imported, **Then** it loads without error with every text element at
   normal size.

---

### User Story 3 - Nodes Reflow to Fit Text (Priority: P2)

A user bumps a label to large on an auto-sized node. The node grows to fit
the bigger text instead of clipping it. A manually resized node keeps its
fixed dimensions and the text wraps or fits within them.

**Why this priority**: Size steps are useless if changing one produces
clipped or overflowing labels; but this is a consequence of the existing
sizing rules, not new behavior.

**Independent Test**: On an auto-sized node, cycle a label through the three
sizes and confirm the node grows/shrinks to fit. Repeat on a manually
resized node and confirm its dimensions do not change.

**Acceptance Scenarios**:

1. **Given** an auto-sized node, **When** a text element is set to large,
   **Then** the node grows to contain the text with no clipping.
2. **Given** a manually resized node, **When** a text element's size
   changes, **Then** the node's dimensions stay fixed and the text remains
   legible within them.

---

### Edge Cases

- Text set to large on a very small manually resized node: text wraps or is
  visibly truncated in a controlled way — never silently overflows the node
  boundary.
- Imported JSON with an unknown size value: falls back to normal rather than
  rejecting the diagram.
- Empty text element with a size set: harmless; the size applies if text is
  later entered.
- Zoomed-out canvas with small-size text: small text may be illegible at low
  zoom, which is acceptable; exports render at natural scale.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every node text element MUST carry a size property with
  exactly three allowed values — small, normal, large — defaulting to
  normal.
- **FR-002**: All node text MUST continue to render with the body font
  token; size steps MUST NOT introduce a separate heading font or style.
- **FR-003**: The user MUST be able to change a text element's size from the
  canvas/editor in no more than two interactions (select + choose).
- **FR-004**: The canonical diagram JSON MUST include each text element's
  size step, and importing MUST restore it exactly.
- **FR-005**: The component-code export and the animated image export MUST
  render each text element at a size proportionally matching the canvas.
- **FR-006**: Diagram JSON lacking size information MUST import with normal
  size and no errors; unknown values MUST fall back to normal.
- **FR-007**: Auto-sized nodes MUST resize to fit their text after a size
  change; manually resized nodes MUST keep their dimensions.
- **FR-008**: Size MUST be expressed only as the closed vocabulary of steps;
  no free-form numeric font size is exposed to the user or the JSON.

### Key Entities

- **Text size step**: A three-value closed vocabulary (small, normal, large)
  carried per node text element; part of the canonical JSON; rendered with
  the body font token at every step.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can change any text element's size in 2 interactions or
  fewer.
- **SC-002**: 100% of size choices survive a JSON export/import round trip.
- **SC-003**: Rendered exports match the canvas's relative text sizing for
  100% of text elements.
- **SC-004**: 100% of pre-feature diagram JSON files import successfully at
  normal size with no user intervention.
- **SC-005**: Zero instances of text clipped by an auto-sized node after a
  size change.

## Assumptions

- Three steps are sufficient; per the project constitution, styling needs
  are met with a closed vocabulary, not free values.
- There is deliberately no header/heading concept on nodes — all text is
  body text; the `headingFont` design token remains reserved for whatever
  export-consumer contexts already use it and is not applied to node text by
  this feature.
- The exact rendered size of each step is a design decision during
  implementation; the spec constrains only clear distinguishability and
  export fidelity.
- Size applies per text element (each editable text on a node), not per
  node, so one node can mix sizes.
