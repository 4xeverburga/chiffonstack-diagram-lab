---

description: "Task list for Kafka Simulation Model (engine-side)"
---

# Tasks: Kafka Simulation Model (Engine-Side)

**Input**: Design documents from `/specs/009-kafka-simulation-model/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/engine-kafka-ports.md, quickstart.md

**Tests**: Included and required by spec (FR-010, SC-001..SC-006, especially deterministic and wall/cliff behavior).

**Organization**: Tasks are grouped by user story to enable independent implementation and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependency)
- **[Story]**: US1/US2/US3/US4
- Every task includes concrete file path(s)

## Path Conventions

Single Vite SPA with worker-hosted engine:
- Engine core: `src/engine/`
- Worker/store adapters: `src/sim/`
- Existing UI adapter/serialization surfaces: `src/lab/`
- Tests: `test/engine/`, `test/lab/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare constants/contracts and planning scaffolding required by all stories.

- [x] T001 Add centralized Kafka constants (saturation threshold and formula constants) in `src/engine/config.ts`
- [x] T002 [P] Add/confirm engine documentation link in `.github/copilot-instructions.md` (SPECKIT plan marker)
- [x] T003 [P] Add feature task checklist shell in `specs/009-kafka-simulation-model/checklists/` if missing

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Engine contract and model infrastructure needed before any story-specific behavior.

**⚠️ CRITICAL**: User story implementation starts only after this phase.

- [x] T004 Extend engine ports contract with Kafka role/config unions in `src/engine/ports.ts`
- [x] T005 [P] Add formula traceability types (`FormulaSource`, `FormulaDescriptor`) in `src/engine/ports.ts`
- [x] T006 [P] Extend metrics contracts (`KafkaNodeMetrics`, edge dual-units fields) in `src/engine/ports.ts`
- [x] T007 Implement sourced hardware profile catalog in `src/engine/kafkaCatalog.ts`
- [x] T008 Implement pure Kafka formula functions (network/cpu/disk ceilings, cliff, status) in `src/engine/kafkaFormulas.ts`
- [x] T009 Implement Kafka runtime/window model integration helpers in `src/engine/kafkaModel.ts`
- [x] T010 Integrate Kafka window metrics into simulation flush path in `src/engine/simulation.ts`
- [x] T011 Ensure worker/store protocol compatibility with extended `MetricsWindow` payload shape in `src/sim/workerProtocol.ts` and `src/sim/store.ts`

**Checkpoint**: Kafka model primitives, contracts, and simulation integration exist and compile.

---

## Phase 3: User Story 1 - Model a healthy Kafka cluster under load (Priority: P1) 🎯 MVP

**Goal**: Healthy regime with accurate ingress conversion, low saturation, and near-zero lag under capacity.

**Independent Test**: Deterministic seeded scenario with offered load below all walls reports healthy status, ingress ~= offered MB/s, saturation ratios < 0.7, lag ~= 0.

### Tests for User Story 1

- [x] T012 [P] [US1] Add deterministic healthy-path integration test in `test/engine/kafkaSimulation.test.ts`
- [x] T013 [P] [US1] Add unit tests for RPS -> MB/s conversion and edge dual-units fields in `test/engine/kafkaSimulation.test.ts`
- [x] T014 [P] [US1] Add/extend unit tests for formula purity and deterministic outputs in `test/engine/` (new `kafkaFormulas.test.ts` or equivalent)

### Implementation for User Story 1

- [x] T015 [US1] Emit producer ingress in MB/s from payload-aware conversion in `src/engine/kafkaModel.ts`
- [x] T016 [US1] Emit edge metrics in both native units and MB/s for producer/consumer <-> Kafka links in `src/engine/kafkaModel.ts`
- [x] T017 [US1] Ensure healthy status resolution when no wall is saturated in `src/engine/kafkaFormulas.ts` and `src/engine/kafkaModel.ts`

**Checkpoint**: US1 passes independently and demonstrates baseline healthy physics.

---

## Phase 4: User Story 2 - Saturate the cluster and identify bottleneck wall (Priority: P2)

**Goal**: Correctly saturate on network, CPU, and disk walls with plateau behavior and saturated status.

**Independent Test**: Three deterministic scenarios each force a distinct binding wall; corresponding saturation ratio hits wall first and throughput plateaus within ±5% analytical ceiling.

### Tests for User Story 2

- [x] T018 [P] [US2] Add network-wall saturation test in `test/engine/kafkaSimulation.test.ts`
- [x] T019 [P] [US2] Add CPU-wall saturation test with TLS+zstd multiplier comparison in `test/engine/kafkaSimulation.test.ts`
- [x] T020 [P] [US2] Add disk-wall saturation test in `test/engine/kafkaSimulation.test.ts`
- [x] T021 [P] [US2] Add saturation-ratio and status derivation unit tests in `test/engine/kafkaFormulas.test.ts`

### Implementation for User Story 2

- [x] T022 [US2] Implement network ceiling with replication factor handling in `src/engine/kafkaFormulas.ts`
- [x] T023 [US2] Implement CPU ceiling with TLS/zstd multipliers in `src/engine/kafkaFormulas.ts`
- [x] T024 [US2] Implement disk ingress ceiling and saturation calculations in `src/engine/kafkaFormulas.ts`
- [x] T025 [US2] Ensure binding-wall status and throughput plateau logic in `src/engine/kafkaModel.ts`

**Checkpoint**: US2 passes independently and identifies active saturation wall correctly.

---

## Phase 5: User Story 3 - Disk Cliff transition and recovery (Priority: P2)

**Goal**: Deterministic abrupt transition from cached to disk-bound consumer throughput when lag exceeds cache capacity, with degraded status.

**Independent Test**: Scenario crosses cache threshold and demonstrates cliff drop; recovery scenario drains lag back below threshold and returns to healthy/cached regime.

### Tests for User Story 3

- [x] T026 [P] [US3] Add disk-cliff crossing test in `test/engine/kafkaSimulation.test.ts`
- [x] T027 [P] [US3] Add recovery-from-cliff test in `test/engine/kafkaSimulation.test.ts`
- [x] T028 [P] [US3] Add unit tests for cache capacity and cliff threshold functions in `test/engine/kafkaFormulas.test.ts`

### Implementation for User Story 3

- [x] T029 [US3] Implement page-cache capacity function with documented overhead in `src/engine/kafkaFormulas.ts`
- [x] T030 [US3] Implement deterministic disk-cliff regime switch and disk-bound read ceiling in `src/engine/kafkaFormulas.ts`
- [x] T031 [US3] Implement lag state evolution and cliff-aware egress calculation in `src/engine/kafkaModel.ts`
- [x] T032 [US3] Ensure degraded/saturated/healthy precedence logic in `src/engine/kafkaFormulas.ts`

**Checkpoint**: US3 independently reproduces disk cliff and recovery behavior.

---

## Phase 6: User Story 4 - Audit formula traceability payloads (Priority: P3)

**Goal**: Every active formula is inspectable as data (name/expression/inputs/sources/binding flag) for feature 010.

**Independent Test**: In healthy, saturated, and disk-cliff regimes, emitted `formulaDescriptors` include non-empty sources and correctly flagged binding formula(s).

### Tests for User Story 4

- [x] T033 [P] [US4] Add descriptor presence + non-empty source tests in `test/engine/kafkaSimulation.test.ts`
- [x] T034 [P] [US4] Add binding-formula correctness tests by regime in `test/engine/kafkaSimulation.test.ts`
- [x] T035 [P] [US4] Add structural gate test for "formula must include >=1 source" in `test/engine/kafkaFormulas.test.ts`

### Implementation for User Story 4

- [x] T036 [US4] Build formula descriptor payload generation in `src/engine/kafkaFormulas.ts`
- [x] T037 [US4] Attach descriptor payloads to Kafka node metrics in `src/engine/kafkaModel.ts`
- [x] T038 [US4] Ensure descriptors expose current inputs and binding state in `src/engine/kafkaModel.ts`

**Checkpoint**: US4 independently delivers auditable formula metadata contract for 010.

---

## Phase 7: Compatibility & Serialization (Cross-Story Requirement FR-011/SC-006)

**Purpose**: Preserve 008 behavior and JSON compatibility while adding Kafka config roles.

- [x] T039 [P] Extend serializer/parser whitelist for new Kafka/producer/consumer role configs in `src/lab/exportDiagram.ts`
- [x] T040 [P] Add round-trip tests for new role serialization (config persists, metrics excluded) in `test/lab/exportDiagram.test.ts`
- [x] T041 [P] Add regression test ensuring 008-era topologies still parse/simulate unchanged in `test/lab/exportDiagram.test.ts` and `test/engine/simulation.test.ts`
- [x] T042 Ensure Inspector legacy role selector remains compile-safe with extended `SimRole` union (no new controls) in `src/lab/Inspector.tsx`

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final quality gates and quickstart validation.

- [x] T043 [P] Run lint and fix all issues: `npm run lint`
- [x] T044 [P] Run full test suite and fix regressions: `npm test`
- [x] T045 [P] Run build and fix type/packaging errors: `npm run build`
- [x] T046 Execute quickstart validation in `specs/009-kafka-simulation-model/quickstart.md`
- [x] T047 Update plan/checklist notes with final outcomes in `specs/009-kafka-simulation-model/`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): no dependencies.
- Phase 2 (Foundational): depends on Phase 1; blocks all stories.
- Phase 3 (US1): starts after Phase 2.
- Phase 4 (US2): starts after Phase 2; independent of US1 for implementation order but should merge cleanly with shared model files.
- Phase 5 (US3): starts after Phase 2; depends on cliff-capable model state logic.
- Phase 6 (US4): starts after Phase 2 and formula functions in place.
- Phase 7 (Compatibility): after foundational contracts and role additions are stable.
- Phase 8 (Polish): after target stories are complete.

### User Story Dependencies

- US1: baseline and MVP.
- US2: additive wall saturation behaviors; can be developed in parallel after foundational phase.
- US3: additive cliff regime behaviors; can be developed in parallel after foundational phase.
- US4: descriptor/auditability surface; can proceed in parallel but validates best after US2/US3 regimes exist.

### Within Each Story

- Tests should be authored first and fail before implementation.
- Formula helpers before model integration logic.
- Model logic before window assertion tests are finalized.

### Parallel Opportunities

- T005/T006 (ports extension facets) in parallel.
- T007/T008 in parallel after T004 contract baseline.
- Test tasks inside each story marked [P] can run concurrently.
- Phase 8 quality gates T043/T044/T045 can run independently.

---

## Parallel Example: US2 saturation walls

```bash
Task: "Add network-wall saturation test in test/engine/kafkaSimulation.test.ts"
Task: "Add CPU-wall saturation test with TLS+zstd multiplier comparison in test/engine/kafkaSimulation.test.ts"
Task: "Add disk-wall saturation test in test/engine/kafkaSimulation.test.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Complete US1 tasks (Phase 3).
3. Validate healthy-cluster deterministic behavior.

### Incremental Delivery

1. Add US2 (wall saturation).
2. Add US3 (Disk Cliff).
3. Add US4 (formula auditability payload).
4. Finalize compatibility and polish phases.

### Team Parallelization

1. One developer on foundational contracts/formulas.
2. One developer on saturation tests and model integration.
3. One developer on compatibility/serialization and regression tests.

---

## Notes

- Keep engine core pure (`src/engine/**`) and adapter-agnostic.
- Preserve 008 tests and behavior while extending contracts.
- Ensure every shipped formula has at least one source citation and pinned test coverage.

