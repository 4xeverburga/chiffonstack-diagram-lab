# Product

## Product

**Diagram Lab** — an open-source architecture-diagram editor by ChiffonStack.
A React Flow (`@xyflow/react`) canvas for composing system topologies (nodes,
edges, heat paths, active/dim emphasis) that export as artifacts you can drop
into any site: a landing page, a blog post, a README.

## Users

Developers, technical founders, and technical writers who need
architecture/system diagrams that match *their* brand and embed cleanly in
*their* pages. They don't want a heavyweight diagramming SaaS, a proprietary
file format, or a diagram that requires a JS runtime to render. They want to
sketch a topology fast, style it with the handful of tokens their site already
defines, and paste the result into their codebase. The first user is
ChiffonStack itself: the landing page's case-study teardowns and blog diagrams
are produced here.

## Product Purpose

Diagram Lab exists to turn "I need a clean architecture diagram for this post"
into a five-minute task with a copy-pasteable result. Success looks like: a
user lays out a topology on the canvas, sets four design tokens to match their
site, clicks export, and pastes a self-contained snippet that renders
pixel-faithful to what they saw — with zero runtime dependencies. The diagram
source (JSON) stays round-trippable, so any exported diagram can be pasted
back in and edited later.

## Export Formats

Export is the product. Everything on the canvas must survive the trip out.
Two audiences, two tracks:

**For developers (code track):**

1. **Diagram JSON** — the canonical, round-trippable source. Stripped of
   React Flow runtime fields; paste it back into the editor to keep editing.
   Manual node resizes are preserved; untouched nodes keep auto-sizing.
   Self-contained by design: node images are embedded as base64 data URIs at
   upload time, so a JSON file can be shared, versioned, or stored anywhere
   and re-imported intact — no external asset references.
2. **React Flow code** — the flagship code export. A component snippet that
   reproduces the diagram live in the consumer's React app, preserving what
   makes React Flow worth using: animated edges (heat-flow), interactivity,
   and pan/zoom. Styled by the caller's design tokens.
3. **Agent-ready bundle** — a downloadable zip containing the React Flow
   component code, the diagram JSON, any image assets, and a `prompt.md`
   explaining the token contract and integration steps — so the user can hand
   the whole thing to a coding agent and say "put this diagram in my app."

**For non-coders (image track):**

4. **Animated SVG** — one self-contained vector covers both static and
   animated needs: edge animation (heat-flow) is preserved as CSS/SMIL
   animation *inside* the SVG, which plays even in a plain `<img>` tag. No
   runtime, no external requests; drops into any page or doc. Where a host
   can't play SVG animation (e.g. importing into a design tool), it degrades
   gracefully to the static frame.

The current static HTML/SVG generator (`exportCode.ts`) is the seed of the
image track; the React Flow code export is the priority for the code track,
since a static snippet loses the animation and interactivity that justify
building diagrams here instead of in a drawing tool.

## Design Personalization

Deliberately minimal: consumers restyle exports through a small design-token
contract (`primaryColor`, `secondaryColor`, `headingFont`, `bodyFont`) rather
than a full theming system. The tool's own chrome uses ChiffonStack defaults,
but nothing brand-specific may leak into an export beyond what the tokens
express. If a styling need can't be met by a token, the answer is usually a
new node/edge *variant* (like `heat-flow`, `dashed`, `active`, `dim`), not a
new token. Don't overshoot: this is an editor with a token contract, not a
design system.

## Open Source

The project is open source. That constrains how it's built:

- **Self-contained and static-hostable** — a Vite SPA with no backend, no
  accounts, no telemetry required to use it. Clone, install, run.
- **No proprietary format** — the diagram source is plain JSON with a small,
  documented shape; exports are plain HTML/SVG and (eventually) plain React.
- **Personalizable, not ChiffonStack-flavored** — the token contract is the
  public API for branding. ChiffonStack's own look is just the default token
  values, not a hard-coded skin.
- **Contributor-legible** — small modules with one job each (`exportCode`,
  `exportDiagram`, `designTokens`, `nodeKinds`, `heatVariants`), conventions
  enforced in CLAUDE.md, lint via oxlint.

## Anti-references

- **Diagramming SaaS lock-in** (Lucidchart-style) — accounts, cloud storage,
  proprietary formats, export paywalls. Diagram Lab's output is text you own.
- **Third-party embeds** — diagrams that display through an iframe, a hosted
  viewer, or a vendor script. The React Flow export is code the consumer owns
  in their own app; the image track must render anywhere with no code at all.
- **Theming-system sprawl** — dozens of tokens, per-node style panels, CSS
  escape hatches. Four tokens and a variant vocabulary; resist additions.
