# Feature Specification: Simplify Node Palette to Node + Text

**Feature Branch**: `007-simplify-node-palette`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "Simplify the left sidebar palette to only two node options: Node (the neutral node, restricted to a single line of text) and Text (a new component kind: a box-less node that supports multiple lines of text). Normal nodes must be blocked from having more than one line of text (verify/enforce existing behavior). Remove all other node options from the sidebar."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Simplified palette with only Node and Text (Priority: P1)

A diagram author opens the lab and looks at the left sidebar's "Add node" palette. Instead of choosing between several visual variants of the same box, they see exactly two options: **Node** — the neutral box used for every system component — and **Text** — a free-floating label for annotations, titles, and explanatory notes. They drag either option onto the canvas (or click to drop it at the center) exactly as before.

**Why this priority**: The palette is the entry point for every diagram. Reducing it to two purposeful choices removes a decision the author shouldn't have to make up front (visual emphasis like "active"/"dim" is a styling concern, not a creation-time concern) and makes room for the genuinely new capability, the Text element.

**Independent Test**: Open the app, inspect the sidebar palette, and confirm it lists exactly "Node" and "Text". Drag and click-add both and confirm each appears on the canvas.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the author views the sidebar palette, **Then** it shows exactly two entries: "Node" and "Text" — no "Active node" or "Dim node" entries.
2. **Given** the palette, **When** the author drags "Node" onto the canvas, **Then** a neutral boxed node is created at the drop position.
3. **Given** the palette, **When** the author clicks "Text", **Then** a text element is created at the canvas center.
4. **Given** a diagram saved before this change that contains active or dim styled nodes, **When** the author opens it, **Then** those nodes still render with their existing styling — only the ability to create new ones from the palette is removed.

---

### User Story 2 - Text element: box-less, multi-line (Priority: P1)

The author adds a **Text** element to annotate a region of the diagram. Unlike a Node, it has no box: no border, no background fill — just the text itself sitting on the canvas. The author writes several lines of text in it (e.g., a short explanatory paragraph or a multi-line caption), and the element grows to fit. It can be moved, selected, connected, and deleted like any other canvas element, and it appears in every export target the same way it appears on the canvas.

**Why this priority**: Multi-line annotation is the capability gap that motivates this change — today every canvas element is a single-line box, so there is no way to put a paragraph of context on a diagram.

**Independent Test**: Add a Text element, type three lines of text into it, and confirm all three lines render on the canvas without any box around them; export the diagram and confirm the text appears in the export.

**Acceptance Scenarios**:

1. **Given** a Text element on the canvas, **When** the author looks at it, **Then** it renders its text with no visible border, background, or box.
2. **Given** a selected Text element, **When** the author enters multiple lines of text, **Then** all lines are kept and rendered as separate lines on the canvas.
3. **Given** a Text element with multi-line content, **When** the author moves, selects, or deletes it, **Then** it behaves like any other canvas element.
4. **Given** a diagram containing a Text element, **When** the author exports the diagram (any export target), **Then** the text appears in the output with its line breaks preserved and without a box.
5. **Given** a diagram containing a Text element, **When** the author saves and reopens the diagram, **Then** the Text element and all its lines are restored.

---

### User Story 3 - Nodes stay single-line (Priority: P2)

The author renames a Node. Whatever they type or paste, the node's label remains a single line: line breaks cannot be entered, and pasted multi-line content is collapsed to one line. If the author needs multi-line content, the Text element is the tool for that.

**Why this priority**: This is mostly enforcement of the current behavior (labels are edited in a single-line field today), but it must hold against paste and programmatic paths too, so the Node/Text distinction stays crisp. It's P2 because the risk is low — the mechanism largely exists.

**Independent Test**: Attempt to paste multi-line text into a Node's label field and confirm the stored and rendered label is a single line.

**Acceptance Scenarios**:

1. **Given** a selected Node, **When** the author types in the label editor, **Then** no line break can be entered.
2. **Given** multi-line text on the clipboard, **When** the author pastes it into a Node's label, **Then** the label is stored and rendered as a single line (line breaks removed or replaced with spaces).
3. **Given** a Node with a long single-line label, **When** it renders, **Then** the label occupies one line as it does today.

---

### Edge Cases

- What happens when a Text element's content is empty or whitespace-only? It should remain selectable on the canvas (so it can be filled in or deleted) rather than becoming invisible and unreachable.
- How does a pre-existing diagram with "active" or "dim" nodes behave? Those nodes keep rendering with their styling; the palette change never rewrites or breaks existing diagrams.
- What happens when very long unbroken text is entered in a Text element? It should wrap or grow without breaking canvas interaction.
- What happens when multi-line text is pasted into a Node label? Line breaks are stripped/collapsed — the label never contains a line break.
- Do node-only affordances (image attachment, resize-for-image) apply to Text elements? No — Text is a pure text component; image assignment is a Node capability.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The sidebar palette MUST offer exactly two creation options: "Node" and "Text".
- **FR-002**: The "Active node" and "Dim node" palette entries MUST be removed from the sidebar.
- **FR-003**: Existing diagrams containing active/dim styled nodes MUST continue to load and render with their existing styling unchanged.
- **FR-004**: Both palette entries MUST support the existing creation interactions: drag onto the canvas at the drop position, and click to add at the canvas center.
- **FR-005**: The Text element MUST render its content with no box: no border, no background, no fill — text only.
- **FR-006**: The Text element MUST support multiple lines of text; line breaks entered by the author are preserved in storage, on-canvas rendering, and all export targets.
- **FR-007**: The Text element MUST support the standard canvas element behaviors: select, move, delete, undo-eligible creation, and persistence across save/reload.
- **FR-008**: An empty Text element MUST remain visible/selectable on the canvas (e.g., via a placeholder or selection outline) so it can be edited or removed.
- **FR-009**: Node labels MUST be restricted to a single line: the label editor MUST NOT accept line-break input, and pasted multi-line content MUST be collapsed to a single line before being stored.
- **FR-010**: All export targets MUST include Text elements, rendered box-less with line breaks preserved, consistent with their on-canvas appearance.
- **FR-011**: Text elements MUST NOT offer Node-only affordances (image attachment and image-driven resizing).

### Key Entities

- **Node**: The existing neutral boxed diagram element. Has a single-line label, optional image, connection handles, and box styling. Unchanged except that its label is now guaranteed single-line through every input path.
- **Text element**: A new kind of canvas component. Attributes: multi-line text content and position. Renders without any box treatment. Participates in selection, movement, deletion, persistence, and export like other canvas elements.
- **Palette entry**: A sidebar option that creates a canvas element. After this change there are exactly two: Node and Text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The sidebar palette presents exactly 2 creation options (down from 3).
- **SC-002**: An author can place a multi-line annotation (3+ lines) on the canvas in under 15 seconds from opening the app.
- **SC-003**: 100% of attempts to introduce a line break into a Node label (typing or pasting) result in a single-line label.
- **SC-004**: 100% of export targets reproduce a Text element's content with its line breaks and without a box.
- **SC-005**: Diagrams created before this change load with zero visual regressions to their existing nodes.

## Assumptions

- Text elements can be connected with edges like other nodes (they are canvas nodes without a box), since removing connectivity would be an extra restriction the description doesn't ask for. If connections on Text elements are unwanted, that's a small follow-up restriction.
- Text elements use the existing text-size step controls where applicable, but do not gain new typography controls in this feature.
- The visual emphasis variants ("active", "dim") remain in the product's styling vocabulary for existing diagrams; this feature only removes their palette entries, it does not migrate or delete existing styled nodes.
- Node label editing continues to happen in the Inspector's single-line field, which already prevents typed line breaks; this feature adds the guarantee that pasted or otherwise-injected line breaks are collapsed.
- "Multiple lines" in Text elements come from explicit line breaks entered by the author; automatic wrapping of long lines is a rendering nicety, not a requirement.
