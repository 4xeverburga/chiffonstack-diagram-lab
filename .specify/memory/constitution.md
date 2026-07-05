<!--
Sync Impact Report
- Version change: 1.1.0 → 1.2.0
- Modified principles:
  - I. Export Fidelity Is the Product — diagram JSON self-containment made explicit
    (node images embedded as base64 data URIs; no external asset references); image
    track resolved from "SVG, GIF" to a single animated SVG export
  - V. Export Targets & Portability — image track is one animated SVG (CSS/SMIL
    animation inside the SVG, playable from an <img> tag); GIF dropped
- Added sections: none
- Removed sections: none
- Bump rationale: MINOR — new explicit portability requirement on diagram JSON;
  image-track format decision narrows prior guidance without invalidating anything
  previously compliant
- Previous amendment (1.0.0 → 1.1.0): React Flow code promoted to flagship code
  export; two-track export model (code: JSON, React Flow code, agent-ready bundle;
  image: SVG/GIF); PRODUCT.md updated in the same change
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check gate is generic
    ("Gates determined based on constitution file"); derives from this file, no edit needed
  - ✅ .specify/templates/spec-template.md — no constitution-specific references
  - ✅ .specify/templates/tasks-template.md — no constitution-specific references
  - ✅ PRODUCT.md — Export Formats section updated in the same change
- Follow-up TODOs: none
-->

# Diagram Lab Constitution

Diagram Lab is ChiffonStack's open-source architecture-diagram editor: a React Flow
(`@xyflow/react`) canvas whose product is its exports — round-trippable diagram JSON,
live React Flow component code (with an agent-ready bundle), and self-contained
animated SVG that embed in any landing page, blog, or README.
See `PRODUCT.md` in the project root for the full product definition.

## Core Principles

### I. Export Fidelity Is the Product

Everything visible on the canvas MUST survive export. Concretely:

- The diagram JSON export is the canonical source format: it MUST round-trip — any
  exported JSON, pasted back into the editor, MUST reproduce the same diagram
  (positions, labels, images, variants, and manual resizes preserved; untouched nodes
  keep auto-sizing behavior).
- The diagram JSON MUST be self-contained and shareable: node images are embedded as
  base64 data URIs at upload time — never file paths, blob/object URLs, or external
  references. A JSON file moved to another machine MUST re-import intact.
- The image-track export (animated SVG) MUST be self-contained: zero JavaScript
  runtime, no React Flow dependency, no external network requests. It MUST render
  anywhere an image renders, with animation carried inside the SVG (CSS/SMIL) so it
  plays even from a plain `<img>` tag.
- The React Flow code export MUST preserve the live qualities of the canvas —
  animated edges, interactivity, pan/zoom. Flattening animation into a static
  representation is the image track's job, not the code track's.
- Any new canvas capability (node kind, edge variant, styling option) MUST ship with
  its export representation in the same change. A feature that renders on canvas but
  degrades or disappears on export is incomplete and MUST NOT merge. Where a host
  cannot express a capability (e.g. a design tool that won't play SVG animation), the
  degradation MUST be a deliberate, documented mapping (e.g. heat-flow falls back to
  its static heat-path frame).

Rationale: users adopt Diagram Lab to paste diagrams into their own pages. A canvas
feature that doesn't export is invisible to the product's actual output.

### II. Minimal Design-Token Contract

Consumers personalize exports exclusively through the small design-token contract —
currently `primaryColor`, `secondaryColor`, `headingFont`, `bodyFont`:

- Brand-specific styling MUST NOT be hard-coded into export output; ChiffonStack's own
  look exists only as the default token values.
- New styling needs MUST first be expressed as node/edge *variants* (e.g. `heat-flow`,
  `dashed`, `active`, `dim`), not as new tokens. Adding a token requires demonstrating
  that no variant can express the need, and requires a constitution amendment
  (MINOR bump) documenting the new contract.
- Per-node arbitrary style overrides, CSS escape hatches, and theming-system sprawl are
  out of scope by design.

Rationale: the token contract is the public branding API. Keeping it tiny keeps exports
predictable, keeps the tool personalizable without becoming a design system, and
prevents overshooting.

### III. Open Source & Self-Contained

The project is open source and MUST remain trivially self-hostable:

- A static Vite SPA: no backend, no accounts, no required telemetry, no cloud storage.
  Clone → install → run is the complete setup.
- No proprietary formats: diagram source is plain JSON with a small documented shape;
  exports are plain React code, SVG, and standard image formats (per Principle V).
  Users own their output as text and assets.
- Features that require a server, an account, or a third-party service to function MUST
  NOT be added to the core editor.

Rationale: lock-in (accounts, cloud formats, export paywalls) is the named
anti-reference. Self-containment is what differentiates the tool.

### IV. Contributor-Legible Codebase

The codebase MUST stay legible to a first-time contributor:

- Small single-purpose modules, one job each (as with `exportCode`, `exportDiagram`,
  `designTokens`, `nodeKinds`, `heatVariants`).
- No default parameter values — every argument passed explicitly at the call site
  (per `CLAUDE.md`). Behavior MUST NOT depend on an omitted argument.
- TypeScript throughout; `oxlint` MUST pass clean before merge.
- Comments explain constraints the code cannot show, not what the next line does.

Rationale: an open-source tool lives or dies by whether outsiders can confidently
change it.

### V. Export Targets & Portability

Exports serve two audiences through two tracks:

- **Code track (developers)**: React Flow component code is the flagship export — it
  is the reason to build a diagram here rather than in a drawing tool, because it
  keeps animation and interactivity. It ships alongside the canonical diagram JSON,
  and as an **agent-ready bundle**: a zip of the component code, diagram JSON, image
  assets, and a `prompt.md` documenting the token contract and integration steps so
  a coding agent can implement the diagram in the consumer's workspace.
- **Image track (non-coders)**: a single self-contained **animated SVG** export for
  designers and writers who don't code — docs, slides, design tools, chat. One format
  covers static and animated needs: animation lives inside the SVG (CSS/SMIL) and
  degrades gracefully to a static frame where hosts don't play it.

All export targets MUST:

- Consume the same canonical diagram JSON and the same design-token contract — no
  target-specific diagram data or styling side channels.
- Be generated from the canvas state deterministically: same diagram + same tokens →
  same output.
- Remain independently usable: no code-track export may be required to view a
  diagram (the image track always suffices for display).

Rationale: a single source of truth with multiple faithful projections keeps exports
consistent and keeps the JSON format the stable center of the product.

## Additional Constraints

- **Stack**: React 19 + TypeScript + Vite SPA; `@xyflow/react` for the canvas;
  `oxlint` for linting. New runtime dependencies require justification in the PR —
  prefer the platform and existing dependencies.
- **Hosting**: the built app MUST work from any static host (including `vite preview`
  and a plain file server behind a path prefix where feasible).
- **Editor chrome vs. export**: the editor UI may use ChiffonStack fonts/colors freely,
  but nothing from the editor chrome may leak into exported artifacts beyond what the
  token contract expresses.
- **Diagram JSON shape**: changes to the serialized shape MUST remain backward
  compatible (old JSON still imports) or ship with an explicit, documented migration.

## Development Workflow & Quality Gates

- `npm run lint` (oxlint) and `npm run build` (tsc + vite build) MUST pass before merge.
- Export-affecting changes MUST be verified by round-tripping: export JSON → re-import →
  visually confirm parity; render each affected export target standalone (React Flow
  code in a bare app, the SVG opened directly in a browser and via an `<img>` tag) →
  visually confirm parity with the canvas, including animation.
- Features are specified before implementation via the Spec Kit flow
  (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`);
  each plan's Constitution Check gate MUST evaluate the change against Principles I–V.
- Complexity beyond what a principle allows MUST be justified in the plan's Complexity
  Tracking table or removed.

## Governance

- This constitution supersedes ad-hoc practice for Diagram Lab. PRs and reviews MUST
  verify compliance with Principles I–V; violations block merge unless explicitly
  justified in the feature plan.
- **Amendments**: proposed as a PR editing this file, with a Sync Impact Report comment
  and any required updates to dependent templates and `PRODUCT.md`. Approval by the
  project maintainer ratifies the amendment.
- **Versioning**: semantic — MAJOR for principle removals/redefinitions or backward-
  incompatible governance changes; MINOR for new principles or materially expanded
  guidance (including any addition to the design-token contract); PATCH for
  clarifications and wording.
- **Compliance review**: the `/speckit-plan` Constitution Check is the standing gate;
  re-check after design (Phase 1) as the plan template requires.

**Version**: 1.2.0 | **Ratified**: 2026-07-04 | **Last Amended**: 2026-07-04
