# Feature Specification: Image Aspect Fit

**Feature Branch**: `002-node-connection-handles`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "When a user attaches an image to a node, the node auto-adjusts to the image's dimensions: it adopts the image's aspect ratio with fixed dimensions (e.g. a 1x1 image makes the node square). The node is treated as manually sized from that point so exports preserve the exact dimensions. All image cropping and editing is out of scope — that belongs in external tools; Diagram Lab only fits the node to the image as uploaded. Existing behavior for nodes without images is unchanged."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Node Fits the Uploaded Image (Priority: P1)

A user uploads an image to a node — a logo, a screenshot, an icon. The node
immediately resizes so its shape matches the image's aspect ratio: a square
image produces a square node, a wide banner produces a wide node. The image
displays whole, without cropping, stretching, or letterboxing.

**Why this priority**: This is the entire feature. Today the node keeps its
own shape regardless of the image, forcing users to eyeball a manual resize
to stop their logo from distorting or being cropped.

**Independent Test**: Upload a square image, a wide image, and a tall image
to three nodes and confirm each node adopts the matching aspect ratio and
shows the full image undistorted.

**Acceptance Scenarios**:

1. **Given** a node without an image, **When** the user uploads a square
   (1:1) image, **Then** the node becomes square and displays the full image
   with no cropping or distortion.
2. **Given** a node without an image, **When** the user uploads a wide
   (e.g. 3:1) image, **Then** the node adopts that wide proportion and shows
   the full image.
3. **Given** a node that just fitted to an image, **When** the user views it,
   **Then** the image fills the node's image area edge to edge — no bars,
   no stretch.

---

### User Story 2 - Fitted Size Is Fixed and Persistent (Priority: P1)

After the node fits to the image, its dimensions behave like a manual resize:
the node keeps that exact size through further editing, JSON export/import,
and every export format. Adding or editing node text does not change the
node's shape.

**Why this priority**: The export suite already preserves manually sized
nodes exactly; piggybacking on that rule is what guarantees the fitted node
survives the trip out pixel-faithful.

**Independent Test**: Fit a node to an image, add text to it, export and
re-import the JSON, and render the component-code and animated-image exports
— confirming the node's dimensions are identical everywhere.

**Acceptance Scenarios**:

1. **Given** a node fitted to an image, **When** the user adds or edits the
   node's text, **Then** the node's dimensions do not change.
2. **Given** a node fitted to an image, **When** the diagram JSON is exported
   and re-imported, **Then** the node restores at exactly the fitted
   dimensions with the image intact.
3. **Given** a node fitted to an image, **When** component code or the
   animated image is exported, **Then** the rendered node matches the canvas
   dimensions and shows the image undistorted.

---

### User Story 3 - User Can Still Resize After the Fit (Priority: P2)

A user whose node fitted to a large image wants it smaller on the canvas.
They resize the node manually; the resize keeps the image's aspect ratio so
the image never distorts.

**Why this priority**: Auto-fit sets the *shape*; the user still controls the
*scale*. Without ratio-locked resizing, any manual adjustment would undo the
feature's core guarantee (undistorted images).

**Independent Test**: Fit a node to a 2:1 image, manually resize it smaller
and larger, and confirm the node stays 2:1 and the image stays undistorted at
every size.

**Acceptance Scenarios**:

1. **Given** a node fitted to an image, **When** the user resizes it,
   **Then** the node's aspect ratio stays locked to the image's ratio and
   the image scales without distortion.
2. **Given** a resized image node, **When** the diagram is exported (JSON,
   code, image), **Then** the chosen size and the locked ratio are preserved.

---

### User Story 4 - Replacing or Removing the Image (Priority: P3)

A user replaces a node's image with a different one, or removes it. On
replace, the node re-fits to the new image's aspect ratio. On removal, the
node returns to normal auto-sizing behavior driven by its content.

**Why this priority**: Completes the lifecycle; less frequent than upload but
leaving it undefined would strand nodes in stale shapes.

**Independent Test**: Replace a square image with a wide one and confirm the
node re-fits; remove the image and confirm the node reverts to auto-sizing.

**Acceptance Scenarios**:

1. **Given** a node fitted to an image, **When** the user uploads a
   different image to it, **Then** the node re-fits to the new image's
   aspect ratio.
2. **Given** a node fitted to an image, **When** the user removes the image,
   **Then** the node returns to auto-sizing based on its remaining content.

---

### Edge Cases

- Extremely elongated images (e.g. 20:1): the node adopts the ratio but is
  clamped to sane minimum/maximum canvas dimensions so it stays selectable
  and doesn't dwarf the diagram; within the clamp the image never distorts.
- Very small images (e.g. 16×16 icon): the node clamps to a minimum usable
  size; the image scales up without the node collapsing to unusable size.
- Upload of a corrupt or unreadable image file: clear feedback, node
  unchanged.
- A node that was already manually resized before the upload: the image fit
  overrides the previous manual size (the upload is the newer intent).
- Node text longer than the image-fitted width: text wraps within the fitted
  width; it does not widen the node.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When an image is attached to a node, the node MUST adopt the
  image's aspect ratio and display the full image without cropping,
  stretching, or empty bars.
- **FR-002**: The fitted dimensions MUST be treated as a manual resize:
  persisted in the canonical diagram JSON and preserved exactly by every
  export format.
- **FR-003**: Subsequent manual resizes of an image node MUST preserve the
  image's aspect ratio.
- **FR-004**: Fitted dimensions MUST be clamped to defined minimum and
  maximum canvas sizes; within the clamp the image MUST NOT distort.
- **FR-005**: Replacing a node's image MUST re-fit the node to the new
  image; removing the image MUST return the node to auto-sizing.
- **FR-006**: Content changes (text edits) on an image-fitted node MUST NOT
  alter its dimensions.
- **FR-007**: The product MUST NOT provide image cropping, rotation, or
  editing; images are used exactly as uploaded.
- **FR-008**: A failed or invalid image upload MUST leave the node unchanged
  and inform the user.

### Key Entities

- **Image-fitted node**: A node whose dimensions were derived from its
  image's aspect ratio and are thereafter fixed (manual-size semantics),
  with the ratio locked for future resizes. Distinguished in the canonical
  JSON only by its persisted dimensions — no new export concepts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of uploaded images display undistorted and uncropped in
  the editor and in every export format.
- **SC-002**: Fitting happens automatically on upload — zero additional user
  interactions to make the node match the image.
- **SC-003**: 100% of image-fitted dimensions survive a JSON export/import
  round trip and match across all export formats.
- **SC-004**: Zero regressions in sizing behavior for nodes without images.

## Assumptions

- Image cropping/editing is explicitly out of scope; users prepare images in
  external tools. This is a product boundary, not a temporary gap.
- Images continue to be embedded in the diagram JSON at upload time (as
  established by the export suite), so fit behavior adds no external asset
  handling.
- The clamp bounds (min/max node size) are design decisions during
  implementation; the spec constrains only that clamping never distorts the
  image.
- "The node becomes the image's shape" governs the node's image area; how
  node text lays out below/inside the fitted node follows existing node
  content rules.
