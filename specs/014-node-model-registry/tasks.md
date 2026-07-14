---
description: "Task list for the node-model registry (feature 014)"
---

# Tasks: Node-Model Registry

**Input**: Design documents from `specs/014-node-model-registry/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/node-model.md, quickstart.md

**Tests**: INCLUDED. The spec's US3 is itself a conformance/test story, and the
SUGAR constitution (VI) mandates unit tests for all pure engine logic.

> **⚠️ Cross-repo:** every path below is in the **`sugar` engine repo** (the
> sibling repo published as `sugar-skills`, MIT), NOT diagram-lab. This spec
> lives in diagram-lab for speckit continuity; `/speckit-implement` must operate
> in `sugar`. Paths are written `sugar/src/...` for clarity. No diagram-lab code
> changes in this feature (the schema-driven Inspector, D3, is a deferred
> follow-up).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (setup, foundational, polish carry no story label)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Module skeleton for the registry and the conformance kit.

- [X] T001 Create the `sugar/src/registry/` module skeleton (dirs `registry/`, `registry/models/`, empty `registry/index.ts` stub) and `sugar/src/conformance/` per plan.md Project Structure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The registry contract, assembly, kind→model resolution, opaque
cross-window state plumbing, and the golden behavior baseline — all required
before any model can migrate.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

- [X] T002 Define the `NodeModel` interface + supporting types (`WindowCtx`, `WindowResult`, `ParamSchema`, config-validation `Result`) in `sugar/src/registry/nodeModel.ts`, per contracts/node-model.md
- [X] T003 Implement `buildRegistry` + `Registry` (`Map<kind, NodeModel>`, throw on duplicate `id` (FR-009) and on an incomplete model) in `sugar/src/registry/registry.ts`
- [X] T004 Implement `resolveModelId(sim)` mapping the diagram `kind`/`profile` shape to a flat model id (R6; queue→queue, host/client_pool→client_pool, host/external_api→external_api, host/{transactional_api,worker_consumer,database_server}→saturatingHost) in `sugar/src/registry/resolve.ts`
- [X] T005 Generalize cross-window state: replace the hardcoded `queueBacklogGB` / `replicaRuntimeByNode` maps with an opaque `stateByNode: Map<string, unknown>` and collapse `nextQueueBacklogGB` / `nextReplicaRuntimeByNode` into `nextStateByNode` — plumbing only, models still on the legacy path — in `sugar/src/simulation.ts` and `sugar/src/flowPropagation.ts` (D2, R2)
- [X] T006 [P] Capture golden `sugar run --json` summaries (fixed `--seed 1`) for all `sugar/examples/*.json` topologies into `sugar/test/golden/` as the behavior baseline (R5)
- [X] T007 [P] Unit tests for `buildRegistry` (duplicate-id throws, incomplete-model throws) in `sugar/test/registry/registry.test.ts`

**Checkpoint**: Registry scaffolding, resolution, generalized state, and goldens exist — behavior still unchanged.

---

## Phase 3: User Story 1 - Add a node type as a single self-contained entry (Priority: P1) 🎯 MVP

**Goal**: Every existing behavior is served through the registry; adding a node
type is one entry + one registration line, with zero edits to the propagation
loop or other models.

**Independent Test**: Register a test-only fixture model and confirm a diagram
using it runs, while the diff shows zero changes to any other model's per-window
logic or the central stepping/dispatch code.

### Tests for User Story 1

- [X] T008 [P] [US1] Extensibility test: register a **test-only fixture model** and assert a diagram using it runs correctly AND that adding it touched only its own file + the one registration line (SC-001/SC-003) in `sugar/test/registry/extensibility.test.ts`

### Implementation for User Story 1 (migrate one model at a time; assert goldens after each — R5)

- [X] T009 [P] [US1] `queueModel` registry entry, folding `sugar/src/queueModel.ts`'s physics as its internals, in `sugar/src/registry/models/queueModel.ts`
- [X] T010 [P] [US1] `clientPoolModel` entry (traffic source; `acceptCapacityRPS` = 0-inbound / generates), delegating to `sugar/src/hostModel.ts` `computeClientPoolMetrics`, in `sugar/src/registry/models/clientPoolModel.ts`
- [X] T011 [P] [US1] `externalApiModel` entry (`acceptCapacityRPS` = +∞), delegating to `computeExternalApiMetrics`, in `sugar/src/registry/models/externalApiModel.ts`
- [X] T012 [US1] `saturatingHostModel` entry covering transactional_api/worker_consumer/database_server (both config modes), delegating physics to `hostModel.ts` + `autoscaler.ts`, owning `ReplicaRuntime` state, in `sugar/src/registry/models/saturatingHostModel.ts`
- [X] T013 [US1] Register all four built-ins (the single enumeration point) in `sugar/src/registry/index.ts`
- [X] T014 [US1] Drive `sugar/src/flowPropagation.ts` through registry hooks (`acceptCapacityRPS` for backpressure, `computeWindow` for output), removing the per-profile `isSaturatingProfile` / `hostAcceptCapacityRPS` / `hostCapacityRPS` branches so the file becomes the generic topological-order driver (shrinks it below the 250-line limit, Constitution VI)
- [X] T015 [US1] Drive `sugar/src/simulation.ts` cross-window state via each model's `initialState` / `reconcileState` / `computeWindow.nextState`, removing the hardcoded profile lists in `resetRuntimeState` / `reclampReplicaRuntimes` / generator scheduling
- [X] T016 [US1] Replace remaining profile-string dispatch with `registry.resolve(sim)` in `sugar/src/summary.ts`, `sugar/src/topology.ts`, `sugar/src/diagramInput.ts`, and `sugar/src/components.ts`
- [X] T017 [US1] Export `NodeModel`, `registry`, and supporting types from the package barrel `sugar/src/index.ts`
- [X] T018 [US1] Assert every golden summary is byte-identical after the full migration (SC-002) and grep-confirm no `sim.profile ===` dispatch remains in the stepping loop (SC-003) — add the assertion in `sugar/test/golden/goldenParity.test.ts`

**Checkpoint**: Engine is fully registry-driven; behavior identical to pre-refactor.

---

## Phase 4: User Story 2 - Existing diagrams and results preserved exactly (Priority: P1)

**Goal**: Determinism, backward compatibility, and graceful degradation are
enforced by tests, not just by the migration's goldens.

**Independent Test**: Run every example before/after with a fixed seed and get
identical summaries; load a pre-refactor file and an unknown-kind file and
confirm both import without error.

### Tests for User Story 2

- [X] T019 [P] [US2] Determinism test: same seed → identical summaries across all examples (against `sugar/test/golden/`) in `sugar/test/registry/determinism.test.ts`
- [X] T020 [P] [US2] Backward-compat test: a pre-refactor diagram fixture imports and runs identically in `sugar/test/registry/backcompat.test.ts`
- [X] T021 [P] [US2] Unknown-kind degradation test: a diagram referencing a kind absent from the registry degrades that node to a plain visual node, leaves the rest intact, and notices a newer version (FR-007) in `sugar/test/registry/unknownKind.test.ts`
- [X] T022 [P] [US2] Schema round-trip test for every registered model, asserting `DIAGRAM_SCHEMA_VERSION` is unchanged (no bump, R6) and the `kind`/`profile` serialized shape is untouched (FR-008), in `sugar/test/registry/roundtrip.test.ts`

**Checkpoint**: Compatibility and determinism guarantees are test-enforced.

---

## Phase 5: User Story 3 - Invalid models are rejected automatically (Priority: P2)

**Goal**: A conformance suite iterates the registry and gates every model on the
five properties; a violating model fails the build naming the property + model.

**Independent Test**: Submit a deliberately non-deterministic model and a
NaN-producing model and confirm the suite fails each, naming the violation.

### Tests / Implementation for User Story 3

- [X] T023 [US3] Conformance harness iterating `registry.byKind` (drives each model on a fixture topology, runs every check below) in `sugar/src/conformance/conformance.test.ts`
- [X] T024 [P] [US3] Determinism check (two seeded runs identical) as a check function in `sugar/src/conformance/checks.ts`
- [X] T025 [P] [US3] Finite / no-NaN check (Infinity only as the explicit unbounded-capacity sentinel) in `sugar/src/conformance/checks.ts`
- [X] T026 [P] [US3] Flow-conservation check (`outflow ≤ inflow + released backlog` within ε) in `sugar/src/conformance/checks.ts`
- [X] T027 [P] [US3] Sourced-formula check reusing `validateFormulaDescriptorsHaveSources` from `sugar/src/formulaCatalog.ts` (FR-011, SC-006), wired into `sugar/src/conformance/checks.ts`
- [X] T028 [P] [US3] Schema round-trip check per model (default config → serialize → parse → equal) in `sugar/src/conformance/checks.ts`
- [X] T029 [US3] Negative tests: a non-deterministic fixture model and a NaN-producing fixture model each fail the suite with a message naming the violated property and model (FR-012) in `sugar/test/conformance/negative.test.ts`

**Checkpoint**: Every registered model is gated by CI conformance.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T030 [P] Update `sugar/SCHEMA.md` to note the registry is an internal dispatch mechanism with no on-disk schema change (no version bump)
- [X] T031 [P] Update `sugar/README.md` (and `sugar/SKILL.md` if it enumerates node kinds) to reference the registry as the extension point
- [X] T032 Run the quickstart.md walkthrough end-to-end (add the fixture model, `npm test` green, goldens match) as the feature's acceptance validation
- [X] T033 Confirm the constitution gate: `oxlint` clean, `tsc` + build pass, full Vitest suite green, and every touched engine file ≤ ~250 lines (verify `flowPropagation.ts` shrank) — Constitution VI
- [X] T034 [P] File the R7 cross-repo governance follow-ups as issues (constitution PATCH updating stale `src/engine/` references post-extraction; a `sugar` pointer to the governing principles) — non-blocking, deferred with D6. Closed via direct remediation: constitution patched to `sugar/src/config.ts`, governance pointer added in `sugar/README.md` and `sugar/CLAUDE.md`; template retained at `sugar/.github/ISSUE_TEMPLATE/t034-governance-follow-ups.md`.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)** → no deps.
- **Foundational (P2)** → depends on Setup; **BLOCKS all user stories** (contract, assembly, resolve, state plumbing, and goldens must exist first).
- **US1 (P3, MVP)** → depends on Foundational. The core migration.
- **US2 (P4)** → depends on Foundational; strongly coupled to US1 (its tests assert US1's migration preserved behavior). Its goldens baseline (T006) is captured in Foundational so US2 tests can run as each model migrates.
- **US3 (P5)** → depends on Foundational + at least one migrated model (US1) so the harness has real models to gate.
- **Polish (P6)** → after US1–US3 as desired.

### Within US1

- Models (T009–T012) are `[P]` — different files — but each is followed by a golden re-check (R5, one model at a time). T013 (registration) after the model files. T014–T016 (drive engine via registry) after registration. T017 (barrel) and T018 (parity assertion) last.

### Parallel opportunities

- T006 + T007 in Foundational.
- T009 / T010 / T011 (queue, client_pool, external_api model files) in US1 — different files. T012 (saturatingHost) is the heavy one, keep it serial with the engine-drive tasks.
- US2 tests T019–T022 all `[P]`.
- US3 checks T024–T028 all `[P]` (independent check modules feeding one harness).

---

## Parallel Example: User Story 1 model migration

```bash
# The three light models can be authored in parallel (different files):
Task: "queueModel entry in sugar/src/registry/models/queueModel.ts"
Task: "clientPoolModel entry in sugar/src/registry/models/clientPoolModel.ts"
Task: "externalApiModel entry in sugar/src/registry/models/externalApiModel.ts"
# saturatingHostModel (T012) and the engine-drive tasks (T014–T016) stay serial.
```

---

## Implementation Strategy

### MVP (US1 only)

1. Setup + Foundational (contract, assembly, resolve, state plumbing, goldens).
2. US1: migrate all four models, drive the engine through the registry, prove
   zero-edit extensibility via the fixture, assert goldens byte-identical.
3. **STOP and VALIDATE**: engine fully registry-driven with identical behavior —
   this alone is the shippable refactor.

### Incremental delivery

1. Foundation ready.
2. + US1 → registry-driven engine (MVP; the assessment's Goal D1/D2 core).
3. + US2 → compatibility/determinism locked by tests.
4. + US3 → conformance kit gates every model in CI (D5).
5. Polish → docs + governance follow-ups.

---

## Notes

- Determinism is the sharpest risk: migrate one model at a time and re-check
  goldens (R5); a diff bisects to the single model just moved.
- `[P]` = different files, no dependency on an incomplete task.
- No `DIAGRAM_SCHEMA_VERSION` bump — the serialized shape is unchanged (R6).
- Hard guardrail (Constitution I): **no new user-facing node type/parameter
  ships**; the only new model is the test-only fixture. A real new type needs a
  constitution amendment.
- Commit after each task or logical group; keep engine files ≤ ~250 lines.
