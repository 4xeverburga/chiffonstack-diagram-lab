# Feature Specification: Diagram Lab Export Suite

**Feature Branch**: `001-export-suite`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Build out the two-track export model defined in PRODUCT.md and constitution v1.2.0, as a prioritized roadmap of independently shippable stories: React Flow component code export (flagship), agent-ready bundle download, animated SVG export, and JPEG support in node image upload with size awareness."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - React Flow Component Code Export (Priority: P1)

A developer builds an architecture diagram on the canvas, sets the four design
tokens to match their site, and clicks "Export code". They receive a
copy-pasteable React Flow component that reproduces the diagram *live* in
their own React app — animated heat-flow edges keep flowing, nodes stay
interactive, pan/zoom works — styled by their tokens, not Diagram Lab's.

**Why this priority**: This is the flagship export and the reason the tool is
built on a live-diagram engine at all. Without it, the product's core promise
("build here, embed live in your app") is unmet; every other export is a
projection of less fidelity.

**Independent Test**: Build a diagram with at least one of each element (plain
node, active node, dim node, node with image, default edge, dashed edge,
heat-flow edge, manually resized node), export the code, drop it into a fresh
React app, and confirm it renders and animates identically to the canvas.

**Acceptance Scenarios**:

1. **Given** a diagram with heat-flow edges on the canvas, **When** the user
   exports component code and mounts it in their own React app, **Then** the
   rendered diagram matches the canvas layout and the heat-flow animation
   plays.
2. **Given** custom design-token values set in the editor, **When** the user
   exports component code, **Then** the exported diagram is styled by those
   token values and contains no Diagram Lab-brand styling beyond the tokens.
3. **Given** a node with an attached image and a manually resized node,
   **When** the code is exported and rendered, **Then** the image displays
   and the resized node keeps its exact dimensions.
4. **Given** an empty canvas, **When** the user attempts a code export,
   **Then** they receive a clear message instead of broken output.

---

### User Story 2 - Agent-Ready Bundle Download (Priority: P2)

A developer finishes a diagram and clicks "Download bundle". They get a single
zip file containing the React Flow component code, the canonical diagram JSON,
any image assets, and a `prompt.md` that explains the design-token contract
and integration steps. They drop the zip into their workspace and tell their
coding agent "add this diagram to my landing page" — the agent has everything
it needs to do the integration unassisted.

**Why this priority**: It's the highest-leverage packaging of Story 1 (which
it depends on) and matches how developers integrate code today — via coding
agents. Cheap to build once the code export exists.

**Independent Test**: Download a bundle for a non-trivial diagram, hand the
unzipped folder to a coding agent in a sample React project with only the
instruction "integrate this diagram", and verify the agent succeeds using
just the bundle's contents.

**Acceptance Scenarios**:

1. **Given** a diagram on the canvas, **When** the user downloads the bundle,
   **Then** the zip contains the component code, the diagram JSON, and a
   `prompt.md` — and the JSON re-imports into the editor intact.
2. **Given** a diagram whose nodes carry uploaded images, **When** the bundle
   is downloaded, **Then** the images are included such that the component
   renders them without reaching back to Diagram Lab or the user's machine
   state.
3. **Given** the bundle's `prompt.md`, **When** read by a coding agent (or a
   human), **Then** it documents the four design tokens, what each controls,
   and the steps to integrate the component into an existing React app.

---

### User Story 3 - Animated SVG Export (Priority: P3)

A designer or technical writer (who doesn't code) builds a diagram and clicks
"Export SVG". They get a single self-contained vector file: heat-flow edge
animation plays inside the SVG — even when the file is used in a plain
`<img>` tag — and where a host can't play animation, the image degrades
gracefully to its static frame. They drop it into docs, slides, blog posts,
or chat with zero code.

**Why this priority**: Serves the non-coder audience and replaces/evolves the
existing static HTML export. Valuable, but the developer code track is the
product's differentiator and comes first.

**Independent Test**: Export an SVG from a diagram with animated and static
edges, open it directly in a browser and via an `<img>` tag, and confirm the
animation plays in both; import it into a design tool and confirm a clean
static frame appears.

**Acceptance Scenarios**:

1. **Given** a diagram with a heat-flow edge, **When** exported as SVG and
   embedded via an `<img>` tag, **Then** the edge animation plays with no
   scripts and no external requests.
2. **Given** custom design tokens, **When** the SVG is exported, **Then**
   colors and fonts reflect the token values.
3. **Given** a host that does not play SVG animation, **When** the SVG is
   displayed, **Then** a complete, legible static frame of the diagram shows
   (no missing edges or half-drawn state).
4. **Given** nodes with uploaded images, **When** the SVG is exported,
   **Then** the images appear inside the SVG without external references.

---

### User Story 4 - JPEG Upload Support & Size Awareness (Priority: P4)

A user attaches a JPEG photo or logo to a node the same way they attach PNGs
and SVGs today. If they attach a large image, the editor nudges them — noting
that images are embedded into the diagram file and large ones make it heavy
to share — without blocking them.

**Why this priority**: Small usability gap-fill. It widens what diagrams can
contain and protects the shareability of diagram JSON, but nothing else
depends on it.

**Independent Test**: Attach a JPEG to a node and confirm it displays on
canvas and survives a JSON export/re-import round trip; attach an
oversized image and confirm a size warning appears while the upload still
succeeds.

**Acceptance Scenarios**:

1. **Given** the node image picker, **When** the user selects a JPEG file,
   **Then** it attaches, displays on the node, and round-trips through JSON
   export/import.
2. **Given** an image over the size threshold, **When** attached, **Then**
   the user sees a non-blocking warning about diagram file size.
3. **Given** a diagram containing a JPEG node image, **When** exported via
   any export target (code, bundle, SVG), **Then** the image appears
   correctly in the output.

---

### Edge Cases

- Empty canvas at export time: every export action must produce a clear
  "add nodes first" message, never an empty or broken artifact.
- Node labels containing characters meaningful in markup or code (quotes,
  angle brackets, backslashes) must survive every export without corrupting
  the output or executing as anything but text.
- Very large diagrams (hundreds of nodes) and very large embedded images:
  exports must either complete or fail with a clear message — never hang the
  editor or silently truncate the diagram.
- A diagram created before this feature (existing JSON shape) must still
  import and export through all new targets.
- Font tokens naming fonts not installed on the viewer's machine: exports
  must specify sensible fallbacks so the diagram stays legible.
- Clipboard/download permissions denied by the browser: the user gets an
  actionable error, not a silent failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to export any canvas diagram as component
  code that reproduces the diagram live — layout, node kinds (default,
  active, dim), node images, manual resizes, edge variants, edge animation,
  and pan/zoom interactivity — in the consumer's own React application.
- **FR-002**: All export targets MUST style their output exclusively through
  the four-token design contract (primary color, secondary color, heading
  font, body font); no Diagram Lab branding may be hard-coded into any
  export.
- **FR-003**: Users MUST be able to download a single bundle (zip) containing
  the component code, the canonical diagram JSON, all image assets needed to
  render, and a `prompt.md` documenting the token contract and integration
  steps for a coding agent.
- **FR-004**: The bundle's diagram JSON MUST re-import into the editor and
  reproduce the same diagram (round-trip parity per constitution
  Principle I).
- **FR-005**: Users MUST be able to export a single self-contained SVG in
  which edge animation plays without scripts or external requests, including
  when displayed through an `<img>` tag, and which degrades to a complete
  static frame where animation isn't supported.
- **FR-006**: The animated SVG export MUST replace the current static HTML
  snippet export as the image-track output (one export action, not two
  competing ones).
- **FR-007**: Node image upload MUST accept JPEG in addition to PNG and SVG,
  embedding all formats into the diagram data as self-contained data (no
  external references), per constitution Principle I.
- **FR-008**: When an attached image exceeds a size threshold, the editor
  MUST show a non-blocking warning explaining the impact on diagram file
  size and shareability.
- **FR-009**: Every export action on an empty canvas MUST produce a clear,
  human-readable message instead of an empty or invalid artifact.
- **FR-010**: All exports MUST be generated deterministically: the same
  diagram with the same tokens produces the same output.
- **FR-011**: Text content (labels) MUST be escaped appropriately for each
  export target so no label can corrupt or inject into the output.

### Key Entities

- **Diagram**: The canvas state — nodes (label, kind, optional embedded
  image, position, optional manual size) and edges (source, target,
  variant). Canonically serialized as self-contained JSON.
- **Design Tokens**: The four-value personalization contract (primary color,
  secondary color, heading font, body font) applied at export time.
- **Export Artifact**: A projection of a Diagram + Design Tokens into a
  target format — component code, bundle (zip), or animated SVG.
- **Bundle Manifest (`prompt.md`)**: Human- and agent-readable integration
  guide shipped inside the bundle; documents tokens, contents, and steps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from finished diagram to a live, animated
  diagram rendering in their own app in under 5 minutes using only exported
  artifacts.
- **SC-002**: 100% of canvas capabilities (node kinds, images, resizes, edge
  variants, animation) survive the code export — verified by exporting a
  reference diagram exercising every capability and comparing against the
  canvas.
- **SC-003**: A coding agent given only the downloaded bundle and the
  instruction "integrate this diagram" completes the integration in a sample
  project without asking for missing information.
- **SC-004**: The exported SVG displays correctly (animated where supported,
  complete static frame elsewhere) with zero network requests and zero
  script execution.
- **SC-005**: A diagram JSON file containing embedded images, moved to a
  different machine, re-imports with 100% fidelity.
- **SC-006**: Exports of a 50-node diagram complete in under 3 seconds on a
  typical laptop; oversized-image warnings appear at attach time, not at
  export time.

## Assumptions

- The existing canvas capability set (label nodes, node kinds, node images,
  manual resize, edge variants including heat-flow/dashed) is the complete
  scope of what exports must express; new canvas capabilities will extend
  exports in the same change per constitution Principle I.
- The React Flow code export targets consumers who already have a React
  project able to install the diagram engine dependency; making the output
  dependency-free is explicitly the image track's job, not the code track's.
- The current static HTML/SVG generator is superseded by the animated SVG
  export (P3); until P3 ships, it remains in place as the image-track
  stopgap.
- "Large image" warning threshold defaults to ~500 KB per image (post-embed
  size), adjustable during implementation; the warning never blocks.
- Bundle downloads happen entirely client-side (the editor remains a static
  app with no backend), consistent with constitution Principle III.
- Fonts are referenced by name with generic fallbacks; embedding font files
  into exports is out of scope for this feature.
- GIF/video export is out of scope (superseded by animated SVG per
  constitution v1.2.0); PDF/PNG raster export is out of scope for v1.
