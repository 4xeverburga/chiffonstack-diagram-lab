<!--
Sync Impact Report
- Version change: 3.1.0 → 3.2.0
- Bump rationale: MINOR — Principle I's closed parameter set gains a third
  new user-facing parameter (feature 013-host-autoscaling, revised same
  day): saturating host profiles gain `bootDelayMs` alongside `minReplicas`/
  `maxReplicas`. Boot delay is reclassified from "internal scaler tunable"
  to "user-facing capability parameter" — unlike watermarks/sustain/
  cooldown (which are scaler ALGORITHM policy, not a property of the
  modeled system), boot delay is a real, observable characteristic of the
  actual infrastructure being modeled (container cold-start vs. JVM warmup
  vs. VM boot vary by orders of magnitude), matching this product's
  existing philosophy of explicit user-declared capability parameters
  (`cpuProcessingTimeMs`, `manualBaselineLatencyMs`, etc.). Watermarks,
  sustain window, cooldown, and the visible-replica cap remain internal
  tunables in `src/engine/config.ts`.
- Modified principles:
  - I. Host-First Model Depth, Closed Parameter Set — closed list extended
    with `bootDelayMs` on transactional_api/worker_consumer/
    database_server (alongside 3.1.0's `minReplicas`/`maxReplicas`);
    updated wording to no longer list boot delay among internal tunables.
- Added sections: none
- Removed sections: none
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check gate is
    generic; derives from this file, no edit needed
  - ✅ .specify/templates/spec-template.md — no constitution-specific references
  - ✅ .specify/templates/tasks-template.md — no constitution-specific references
  - ✅ PRODUCT.md — "Hosts first, lean parameters" bullet updated to mention
    bootDelayMs in the same change
- Follow-up TODOs: none
-->

# SUGAR Constitution

SUGAR is ChiffonStack's interactive performance, capacity, and chaos simulator for
software architectures and data pipelines: a React Flow (`@xyflow/react`) canvas
where engineers model topologies, describe each host's capability with a small set
of explicit parameters (known capability curve, or CPU time × worker threads), and
watch the system breathe, congest, or collapse under load — driven by a
discrete-event simulation engine running in the browser.
See `PRODUCT.md` in the project root for the full product definition.

## Core Principles

### I. Host-First Model Depth, Closed Parameter Set

Compute is the hard rightsizing problem; queues are connective tissue. The target
users (data engineers, system architects, SREs) already understand queues — what
they cannot eyeball is how hosts interact and where saturation appears first:

- Host nodes (client pool, transactional API, worker/consumer, database,
  external API) are the deeply modeled components. Their model MUST cover:
  saturation ratio (offered load vs capacity), a smooth ρ/(1−ρ) hockey-stick
  latency curve with no threshold discontinuities, and dual configuration
  modes — manual (known capability curve) and calculated (derived from CPU
  time and worker threads, weighted by inbound edge compute multipliers).
- Queue nodes are deliberately generic: unbounded buffers with **zero
  configuration parameters**, reporting telemetry only (throughput in/out,
  accumulated backlog). Their outflow derives from downstream host capacity.
  No technology-specific queue modeling (Kafka, RabbitMQ, SQS, …) without a
  constitution amendment.
- The retired deep Kafka model (Disk Cliff, page cache, TLS/compression vCPU
  multipliers, hardware instance profiles) is dead weight and MUST be removed,
  not maintained.
- The user-facing simulation parameter set is **closed** to the lean list in
  spec 011 FR-020 plus spec 013's replica bounds and boot delay: host —
  `requestRatePerSec` (client pool) | `manualBaselineLatencyMs`,
  `manualSaturationRPS`, `manualMaxRPS` (manual) | `cpuProcessingTimeMs`,
  `maxWorkerThreads` (calculated) | `minReplicas`, `maxReplicas`,
  `bootDelayMs` (transactional_api/worker_consumer/database_server only,
  either config mode); edge — `trafficShareRatio`, `averagePayloadSizeKB`,
  `targetComputeWeightMultiplier`, `pathIoLatencyMs`; queue — none. Adding
  any new user-facing parameter or resource dimension (network bandwidth
  ceilings, disk/IO velocity, RAM/page-cache sizing, hardware instance
  profiles) REQUIRES a constitution amendment. Internal engine tunables in
  central config are exempt but MUST NOT surface as user inputs — this
  explicitly includes the autoscaler's watermarks, sustain window, cooldown,
  and the visible-replica cap on the canvas, all of which live in
  `src/engine/config.ts`. Boot delay is a user-declared capability
  parameter (`bootDelayMs`), not an internal tunable — it varies by real
  infrastructure (container vs. VM vs. serverless cold start), unlike the
  scaler's own algorithm-policy constants.

Rationale: a lean model users fully understand beats a detailed model they
must trust blindly; parameter bloat is the failure mode that killed the
Kafka-first iteration. Depth now means fidelity of interaction between hosts,
not fidelity of any single vendor technology.

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

- The engine (event queue, component models, formulas, unit conversion) is
  pure TypeScript: no imports of React, DOM APIs, `@xyflow/react`, or Zustand
  anywhere in the core. `data in → data out`.
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
- Node/edge `data` carries simulation state (`status`, `saturationRatio`,
  `currentLatencyMs`, `currentRPS`, `backlogGB`, …) updated once per metric
  window.

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
  component-code export, agent bundle) and the retired deep Kafka model
  (hardware catalog, Kafka formulas/metrics surfaces) are dead weight under
  this constitution and MUST be removed rather than maintained.

## Development Workflow & Quality Gates

- `npm run lint` (oxlint), `npm run build` (tsc + vite build), and `npm run
  test` (vitest) MUST pass before merge — enforced by GitHub Actions CI on
  every push and pull request. A red CI blocks merge.
- Model-affecting changes MUST be verified two ways: unit tests on the formula
  functions (exact expected values at known operating points, including the
  saturation region), and a canvas smoke check that the Inspector shows
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
  an amendment to Principle III; adding a user-facing simulation parameter or
  a technology-specific queue model requires an amendment to Principle I.
- **Versioning**: semantic — MAJOR for principle removals/redefinitions or
  backward-incompatible governance changes; MINOR for new principles or
  materially expanded guidance (including each new parameter or deeply modeled
  technology admitted past the closed-parameter gate); PATCH for
  clarifications and wording.
- **Compliance review**: the `/speckit-plan` Constitution Check is the standing
  gate; re-check after design (Phase 1) as the plan template requires.

**Version**: 3.2.0 | **Ratified**: 2026-07-04 | **Last Amended**: 2026-07-07
