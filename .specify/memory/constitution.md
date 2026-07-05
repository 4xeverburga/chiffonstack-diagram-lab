<!--
Sync Impact Report
- Version change: 1.3.0 → 2.0.0
- Bump rationale: MAJOR — product pivot from Diagram Lab (static diagram editor
  whose product was its exports) to SUGAR (interactive performance/capacity
  simulator). Former Principles I (Export Fidelity), II (Design-Token Contract),
  and V (Export Targets & Portability) are removed; the export pipeline is no
  longer part of the product.
- Modified principles:
  - I. Export Fidelity Is the Product → removed
  - II. Minimal Design-Token Contract → removed (tokens survive only as editor
    styling, no longer a public contract)
  - III. Open Source & Self-Contained → III. Open Source & Web-First (CSR-only
    scope made explicit; Live Mock Server / CLI / VS Code extension deferred)
  - IV. Contributor-Legible Codebase → VI. Contributor-Legible Codebase
    (retained; functional-core rule superseded by the stronger Principle IV
    ports-and-adapters rule for the simulation engine)
  - V. Export Targets & Portability → removed
- Added principles:
  - I. Kafka-First Model Depth
  - II. Every Formula Is Traceable
  - IV. Simulation Core Behind Ports (hexagonal-lite)
  - V. Render Discipline: Aggregate, Never Per-Event
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check gate is generic;
    derives from this file, no edit needed
  - ✅ .specify/templates/spec-template.md — no constitution-specific references
  - ✅ .specify/templates/tasks-template.md — no constitution-specific references
  - ✅ PRODUCT.md — rewritten for SUGAR in the same change
  - ⚠ CLAUDE.md — still points at specs/003-edge-styling-controls/plan.md as
    "the current plan"; update when the first SUGAR feature plan exists
- Follow-up TODOs:
  - TODO: create the first SUGAR feature spec (simulation engine core + Kafka
    model) and repoint CLAUDE.md at its plan
-->

# SUGAR Constitution

SUGAR is ChiffonStack's interactive performance, capacity, and chaos simulator for
software architectures and data pipelines: a React Flow (`@xyflow/react`) canvas
where engineers model topologies, assign real hardware profiles (vCPU, RAM, disk),
and watch the system breathe, congest, scale, or collapse under load — driven by a
discrete-event simulation engine running in the browser.
See `PRODUCT.md` in the project root for the full product definition.

## Core Principles

### I. Kafka-First Model Depth

One technology modeled deeply and credibly beats four modeled superficially:

- Kafka is the first and, until it is complete, the only deeply modeled component.
  Its model MUST cover the physics named in the product vision: ingress/egress
  network bandwidth, vCPU saturation (with TLS and compression multipliers), and
  the Disk Cliff (consumer lag exceeding OS page-cache RAM forcing disk reads).
- New component types (Spark, Airflow, FastAPI, …) MUST NOT gain simulation
  formulas until the Kafka model is implemented, sourced (Principle II), and
  validated end-to-end in the canvas. Until then, non-Kafka nodes may exist only
  as pass-through or fixed-rate placeholders that are visibly labeled as such.
- Generic building blocks (load generators, sinks, edge unit converters
  RPS ↔ MB/s) are infrastructure, not models — they are exempt from this gate.

Rationale: the target users (SREs, data engineers) will distrust the whole tool
the first time one number is badly wrong. Depth on one technology establishes the
credibility that breadth can later inherit.

### II. Every Formula Is Traceable

A simulation result users cannot audit is a simulation result users will not trust:

- Every formula the engine applies MUST be inspectable in the UI: when a node is
  selected, the right sidebar (Inspector) MUST show the active formula(s) and the
  source(s) they derive from (paper, vendor doc, benchmark — a citation, not
  "trust us").
- Formulas live in the simulation core as named, individually unit-tested
  functions, each carrying its source reference as structured metadata (not a
  code comment), so the Inspector renders it from data.
- A model change that alters a formula MUST update its source metadata in the
  same change. A formula without a source MUST NOT merge.
- Simulated numbers are positioned as directionally correct for comparing
  scenarios, never as guarantees; UI copy MUST NOT claim otherwise.

Rationale: traceability is the product's answer to the credibility risk — it
turns "magic number" into "number with a bibliography".

### III. Open Source & Web-First

The project is open source and, in its current scope, a pure client-side app:

- A static Vite SPA (CSR): no backend, no accounts, no required telemetry.
  Clone → install → run is the complete setup; the built app works from any
  static host (deploy target: `sugar.kekeros.com`).
- The only simulation mode in scope is the theoretical discrete-event engine
  with synthetic traffic generators (Poisson, bursts). The Live Mock Server,
  companion CLI, and VS Code extension are explicitly deferred: no code, specs,
  or UI affordances for them until a constitution amendment brings them into
  scope. Designing the core so they can plug in later is Principle IV's job.
- Topology source is plain JSON with a small documented shape; users own their
  models as text. Changes to the serialized shape MUST remain backward
  compatible (old JSON still imports) or ship with a documented migration.

Rationale: web-only keeps the surface small while the engine earns credibility;
lock-in remains the named anti-reference.

### IV. Simulation Core Behind Ports (hexagonal-lite)

The simulation engine is the product's core and MUST stay independent of its
delivery mechanisms:

- The engine (event queue, component models, formulas, unit conversion,
  hardware profiles) is pure TypeScript: no imports of React, DOM APIs,
  `@xyflow/react`, or Zustand anywhere in the core. `data in → data out`.
- The core is consumed exclusively through explicit ports (TypeScript
  interfaces): a topology input port, a traffic-source port, and a metrics
  output port. The Web Worker host, the canvas UI, and the stochastic
  generators are adapters behind those ports.
- Future integrations (GitHub topology import/export, the deferred local-mode
  server) MUST be implementable as new adapters without modifying the core.
  A change that makes the core aware of a specific adapter is a violation.
- Full hexagonal ceremony is out of scope for the UI: React components,
  Zustand stores, and canvas code stay plain idiomatic React — ports and
  adapters apply to the engine boundary only.

Rationale: the same core must eventually serve the browser worker, a Node
process, and CI-driven runs; the boundary is cheap now and prohibitive later.

### V. Render Discipline: Aggregate, Never Per-Event

The UI must stay fluid while the engine processes extreme event rates:

- The engine runs in a Web Worker and communicates with the UI only through
  aggregated metric windows (fixed-interval snapshots), never per-event
  messages. Simulated events MUST NOT cause React state updates.
- No per-packet/per-token DOM nodes or particles on edges. Edge activity is
  visualized with the existing flow animation (`HeatEdge`), whose speed and
  density are driven by mapping throughput through a bounded sigmoid
  (logistic) function onto CSS variables (`animation-duration`,
  `stroke-dasharray`).
- All animation variables MUST be bounded: whatever the throughput
  (0 → ∞), the mapped visual values stay within fixed min/max so the canvas
  never degenerates at burst load.
- Node/edge `data` carries simulation state (`status`, `currentRPS`,
  `consumerLag`, `pageCacheHitRatio`, …) updated once per metric window.

Rationale: a simulator that freezes under the very load it simulates refutes
itself; bounded CSS-driven animation makes cost independent of event rate.

### VI. Contributor-Legible Codebase

The codebase MUST stay legible to a first-time contributor:

- Small single-purpose modules, one job each. Source files SHOULD stay under
  ~250 lines; a file crossing 300 lines MUST be split by responsibility (or
  the exception justified in the PR).
- No default parameter values — every argument passed explicitly at the call
  site (per `CLAUDE.md`). Behavior MUST NOT depend on an omitted argument.
- TypeScript throughout; `oxlint` MUST pass clean before merge.
- Pure logic — every engine formula, unit conversion, serialization, and the
  sigmoid mapping — MUST have unit tests. The UI shell is covered by manual
  verification, not mandatory component tests.
- Comments explain constraints the code cannot show, not what the next line
  does.

Rationale: an open-source tool lives or dies by whether outsiders can
confidently change it — doubly so when the code encodes physics formulas.

## Additional Constraints

- **Stack**: React 19 + TypeScript + Vite SPA; `@xyflow/react` for the canvas;
  Zustand for global state (nodes, edges, simulation status); `oxlint` for
  linting; Vitest for tests. New runtime dependencies require justification in
  the PR — prefer the platform and existing dependencies.
- **State shape**: all node/edge simulation payloads live in the React Flow
  `data` property so topologies serialize naturally; UI-only callbacks and
  transient render props MUST be whitelisted out of the serialized JSON.
- **Legacy code**: remaining Diagram Lab export pipeline code (SVG export,
  component-code export, agent bundle) is dead weight under this constitution
  and MUST be removed rather than maintained.

## Development Workflow & Quality Gates

- `npm run lint` (oxlint), `npm run build` (tsc + vite build), and `npm run
  test` (vitest) MUST pass before merge — enforced by GitHub Actions CI on
  every push and pull request. A red CI blocks merge.
- Model-affecting changes MUST be verified two ways: unit tests on the formula
  functions (exact expected values at known operating points, including the
  saturation/cliff regions), and a canvas smoke check that the Inspector shows
  the updated formula and sources.
- Performance-affecting changes to the worker/UI boundary MUST be checked
  against the render-discipline rule: no per-event messages, no unbounded
  animation values.
- Features are specified before implementation via the Spec Kit flow
  (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`); each plan's Constitution Check gate MUST evaluate the
  change against Principles I–VI.
- Complexity beyond what a principle allows MUST be justified in the plan's
  Complexity Tracking table or removed.

## Governance

- This constitution supersedes ad-hoc practice for SUGAR. PRs and reviews MUST
  verify compliance with Principles I–VI; violations block merge unless
  explicitly justified in the feature plan.
- **Amendments**: proposed as a PR editing this file, with a Sync Impact Report
  comment and any required updates to dependent templates and `PRODUCT.md`.
  Approval by the project maintainer ratifies the amendment. Bringing the
  deferred local mode (Live Mock Server / CLI / extension) into scope requires
  an amendment to Principle III.
- **Versioning**: semantic — MAJOR for principle removals/redefinitions or
  backward-incompatible governance changes; MINOR for new principles or
  materially expanded guidance (including each new deeply modeled technology
  admitted past the Kafka-first gate); PATCH for clarifications and wording.
- **Compliance review**: the `/speckit-plan` Constitution Check is the standing
  gate; re-check after design (Phase 1) as the plan template requires.

**Version**: 2.0.0 | **Ratified**: 2026-07-04 | **Last Amended**: 2026-07-05
