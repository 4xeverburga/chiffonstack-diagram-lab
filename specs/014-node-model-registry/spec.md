# Feature Specification: Node-Model Registry

**Feature Branch**: `014-node-model-registry`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Node-model registry: turn the engine's closed, hardcoded set of node behaviors into an extensible registry where each node type is one self-contained entry."

## Overview

The simulation engine today understands a **closed, hardcoded set of node
behaviors** ("profiles": a traffic-generating client pool, an external API, a
saturating/autoscaling server in its transactional/worker/database variants,
and a zero-config queue). Each behavior's physics — how it consumes incoming
traffic, when it saturates, how it autoscales, what state it carries between
time windows — is spread across many decision points in several engine files,
selected by string comparison on the profile name. Adding a new node type
(a cache, a load balancer, a message broker) means editing every one of those
files and risks silently missing a decision point.

This feature turns that closed set into an **extensible registry**: each node
type becomes a single self-contained entry that owns everything about itself,
so adding a type means adding one entry — not editing scattered logic. The
engine consults the registry instead of branching on profile strings. Because
the engine already feeds the app, the headless runner/agent-skill, and every
exported file, a newly contributed model reaches all three at once.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a node type as a single self-contained entry (Priority: P1)

A contributor (or the maintainer) wants to add a brand-new node behavior — for
example a cache with a hit-ratio and a backing store. They author one new
registry entry describing the node's configurable parameters, its validation
rules, its starting state, and how it transforms one window of incoming traffic
into outgoing traffic plus a health status. They register it in one place. They
do **not** touch the engine's stepping loop, the flow-propagation logic, the
summary builder, or any other model's code.

**Why this priority**: This is the entire point of the feature — turning a
closed set into an extensible one. Without it, nothing else matters.

**Independent Test**: Add a new reference model (e.g. a cache) end to end and
confirm a diagram using it simulates correctly, while the diff shows zero
changes to the per-window logic of any other model or to the engine's central
stepping/dispatch code.

**Acceptance Scenarios**:

1. **Given** the registry with the built-in reference models, **When** a new
   model entry is registered, **Then** a diagram that uses that node kind runs,
   summarizes, and sweeps without any change to existing model code.
2. **Given** a new model entry, **When** its declared parameters, validation,
   starting state, and per-window behavior are provided, **Then** those are the
   only things the author had to write for the node to be fully functional
   across running, summarizing, and exporting.
3. **Given** two entries registered under the same node-kind identifier,
   **When** the registry is assembled, **Then** the conflict is detected and
   surfaced rather than one silently shadowing the other.

---

### User Story 2 - Existing diagrams and results are preserved exactly (Priority: P1)

An existing user opens a diagram authored before this refactor (or one of the
bundled example topologies) and runs it. The simulation produces the same
health outcomes, saturation ordering, and numeric summaries as before. A file
saved before the change still loads; a file referencing a node kind this build
does not know still loads (degrading that node to a plain visual node) instead
of crashing.

**Why this priority**: The refactor must be behavior-preserving. A registry
that changes the physics or breaks old files destroys trust in the tool and the
privacy/portability promise of the file format. This is the guardrail on P1.

**Independent Test**: Run every bundled example topology with a fixed seed
before and after the change and confirm the agent-facing summaries are
identical; load a pre-refactor file and a file with an unknown node kind and
confirm both import without error.

**Acceptance Scenarios**:

1. **Given** a fixed seed and any bundled example topology, **When** it is
   simulated before and after the refactor, **Then** the resulting summaries
   are identical (determinism and physics preserved).
2. **Given** a diagram file saved before this feature, **When** it is imported,
   **Then** it loads and runs identically to before.
3. **Given** a diagram file that references a node kind not present in this
   build, **When** it is imported, **Then** the unknown node degrades to a plain
   visual node, the rest of the diagram is unaffected, and the user is notified
   the file may come from a newer version.
4. **Given** the interchange schema version, **When** a diagram is exported and
   re-imported, **Then** it round-trips without loss for every registered model.

---

### User Story 3 - Invalid models are rejected automatically (Priority: P2)

A contributor submits a new model. Automated conformance checks run against it
and reject it if it is non-deterministic (same seed → different result),
produces invalid numbers, fails to conserve flow (invents or loses traffic
without accounting), lacks a cited source for its formulas, or breaks schema
round-tripping. The maintainer never has to hand-audit these properties.

**Why this priority**: The registry invites contributions; without an automated
quality bar, one bad model can corrupt determinism or trust for the whole tool.
Guards the P1 extensibility so it doesn't become a liability.

**Independent Test**: Submit a deliberately non-deterministic model and a
NaN-producing model and confirm the conformance suite fails the build for each,
naming the violated property.

**Acceptance Scenarios**:

1. **Given** a registered model, **When** the conformance suite runs, **Then**
   it verifies determinism, valid-number output, flow conservation, sourced
   formulas, and schema round-trip for that model.
2. **Given** a model that violates any checked property, **When** conformance
   runs, **Then** the build fails and names the violated property and model.

### Edge Cases

- A diagram references a node kind that this build does not know → the node
  degrades to a plain visual node; the rest of the diagram runs; the user is
  notified the file may be from a newer version.
- A node's configuration fails its model's validation → it is not simulated with
  an invalid config; the user gets a clear, specific error.
- A node that carries cross-window state (e.g. a backlog, a running replica
  count) is deleted mid-run → its state is reconciled/dropped without affecting
  other nodes' results.
- Two models are registered under the same node-kind identifier → detected as a
  conflict, not silently shadowed.
- A model omits a required part of its contract (no starting state, no per-window
  behavior) → registration fails loudly rather than producing undefined runtime
  behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The engine MUST resolve each node's behavior by consulting a
  registry keyed by node kind, not by comparing profile strings at scattered
  decision points.
- **FR-002**: A registry entry MUST fully own its node type: the set of
  configurable parameters, the rules that validate a configuration, the node's
  starting state, and how one window of incoming traffic becomes outgoing
  traffic plus a health status.
- **FR-003**: Adding a new node type MUST require only authoring and registering
  its entry — with no edits to the central stepping/dispatch logic or to any
  other model's code.
- **FR-004**: The engine's existing behaviors MUST be re-expressed as built-in
  reference entries in the registry, and MUST be served exclusively through the
  registry (no parallel legacy dispatch path remaining).
- **FR-005**: Simulation results MUST be behavior-identical before and after the
  refactor for the same inputs and seed (determinism and physics preserved).
- **FR-006**: Cross-window per-node state MUST be owned by the model rather than
  held in behavior-specific structures in the central engine, with a defined way
  to reconcile state when nodes appear or disappear between windows.
- **FR-007**: The interchange schema version MUST remain the single source of
  truth; parsers MUST accept any version at or below the current one, and MUST
  degrade an unrecognized node kind to a plain visual node rather than failing.
- **FR-008**: Exported diagrams MUST round-trip losslessly through export and
  re-import for every registered model.
- **FR-009**: The system MUST detect and surface a registration conflict when two
  entries claim the same node-kind identifier.
- **FR-010**: The system MUST reject a node configuration that fails its model's
  validation with a clear, specific message, and MUST NOT simulate that node
  with an invalid configuration.
- **FR-011**: An automated conformance suite MUST run against every registered
  model and MUST verify: determinism, valid-number output (no invalid numeric
  results), flow conservation, presence of a cited formula source, and schema
  round-trip.
- **FR-012**: The conformance suite MUST fail the build and name the violated
  property and model when any registered model fails a check.
- **FR-013**: The system MUST NOT execute node-model code loaded at runtime from
  a diagram file or any untrusted source; only models built into the shipped
  build may run (registry is curated in-repo).
- **FR-014**: The engine package MUST remain independently consumable and MUST
  NOT depend on or bundle assets from the canvas application.
- **FR-015**: A model's declared parameters MUST be expressed as data (not
  behavior-specific form code), so a later feature can drive the config panel
  from them; this feature only requires that the declaration exists and drives
  validation, not that the panel consumes it.

### Key Entities *(include if feature involves data)*

- **Node Model**: A self-contained description of one node type — its
  configurable parameters, configuration-validation rules, starting state, and
  per-window behavior (incoming traffic → outgoing traffic + health status),
  plus the cited source of its formulas.
- **Registry**: The curated collection of node models, keyed by node kind, that
  the engine consults; assembled at build time, conflict-checked.
- **Parameter Schema**: A model's declared set of configurable inputs — names,
  types, allowed ranges, and any mode-dependent groupings — expressed as data
  and used to validate configurations (and, in a follow-up feature, to drive the
  config panel).
- **Node State**: The per-node information a model carries across time windows
  (e.g. a backlog, a running replica count), owned by the model.
- **Conformance Check**: An automated property (determinism, valid numbers, flow
  conservation, sourced formula, schema round-trip) evaluated against every
  registered model.
- **Interchange Schema Version**: The single versioned contract stamped on every
  exported diagram governing backward/forward compatibility.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Adding a new reference node model touches only its own new
  entry/file(s) plus one registration line — **zero** lines changed in the
  per-window behavior of any other model or in the engine's central
  stepping/dispatch code (verified by inspecting the change's diff).
- **SC-002**: 100% of bundled example topologies produce identical agent-facing
  summaries for a fixed seed before and after the refactor.
- **SC-003**: 100% of the engine's existing node behaviors are served through the
  registry, with no remaining profile-string dispatch in the stepping loop.
- **SC-004**: The conformance suite runs against every registered model on every
  build and blocks a merge when any model violates determinism, valid-number
  output, flow conservation, sourced formulas, or schema round-trip.
- **SC-005**: A diagram file referencing an unknown node kind imports
  successfully in 100% of cases, degrading the unknown node to a plain visual
  node with a user-visible notice.
- **SC-006**: Every registered model declares a cited source for each of its
  formulas, enforced by the conformance suite (a model with an uncited formula
  cannot merge).

## Assumptions

- **All built-ins migrate at once.** The refactor is complete only when every
  existing behavior is served through the registry; a half-migrated state with
  both a registry and legacy dispatch is explicitly not the target.
- **Parameter-schema expressiveness = today's needs.** The declared-parameter
  system needs to express at least what today's behaviors use: bounded numeric
  inputs, enumerated choices, and mode-dependent parameter groups (e.g. a
  "manual" vs "calculated" configuration mode). Richer schema features are out
  of scope unless a reference model requires them.
- **No runtime plugin execution (hard security invariant).** The registry is
  curated in-repo and shipped in the build. Because diagram files load from
  anywhere, executing model code carried in or referenced by a file would be a
  code-execution vector and is out of scope. A future declarative
  (non-executable) formula layer is explicitly deferred.
- **Engine/UI licensing boundary holds.** The engine remains independently
  publishable and must not bundle canvas-application assets; any config-panel
  work lands in the canvas application, not the engine package.
- **The interchange schema version is already the single source of truth** and
  is imported (not mirrored) by the canvas application.
- **Scope resolved (2026-07-13)**: this feature is the **engine registry** —
  the behavior contract, the built-in reference models, generalized cross-window
  state, curated distribution, and the conformance kit. The schema-driven config
  panel and the contributor documentation are out of scope here (see Out of
  Scope), following the precedent where an engine model shipped ahead of its UI.

## Out of Scope (dependent follow-ups)

- **Schema-driven config panel (D3)** — the canvas application rendering a
  node's config inputs from its model's declared parameters. Deferred to a
  separate follow-up feature so the engine contract stabilizes first (mirrors
  the engine-model-then-UI split of a prior feature). This feature only requires
  that parameters are declared as data (FR-015).
- **Contributor documentation (D6)** — the contribution guide, the "write your
  first node model" tutorial, and the formula-citation change template. Deferred
  until the registry has shipped and there is real external-contribution demand,
  so the docs don't churn with the contract. Note the conformance kit (D5,
  in scope) already enforces the formula-citation *bar* mechanically; only the
  human-facing prose is deferred.
- **Declarative (non-executable) formula layer** — a possible future middle
  ground between built-in models and untrusted plugins. Explicitly deferred; no
  runtime-loaded model code in this feature (FR-013).

## Dependencies

- The versioned interchange schema (already shipped) — this feature builds on
  it and must not regress its backward-compatibility guarantees.
- The headless runner / agent skill and the canvas application both consume the
  engine; both must continue to work unchanged through the registry indirection.
