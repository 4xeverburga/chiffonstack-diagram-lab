---

description: "Task list for Simulation Engine Walking Skeleton"
---

# Tasks: Simulation Engine Walking Skeleton

**Input**: Design documents from `/specs/008-simulation-engine-skeleton/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/engine-ports.md, quickstart.md

**Tests**: Included — the plan's own structure carves out `test/engine/`, `test/sim/`, and `test/fixtures/`, and Principle VI / SC-005 require engine logic to be unit-tested without a browser.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1/US2/US3)

## Path Conventions

Single Vite SPA. `src/engine/` (pure TS core), `src/sim/` (adapters), `src/lab/` (existing canvas modules), `test/engine/`, `test/sim/`, `test/lab/`, `test/fixtures/`.

---

## Phase 1: Setup

**Purpose**: Dependency and tooling changes needed before any engine/adapter code exists.

- [x] T001 Add `zustand` to `dependencies` and remove `fflate` from `dependencies` in [package.json](../../package.json), then run `npm install`
- [x] T002 [P] Add an oxlint `no-restricted-imports` override scoped to `src/engine/**` banning `react`, `react-dom`, `@xyflow/react`, `zustand`, and relative imports that escape `src/engine/` (new/updated `.oxlintrc.json` at repo root)
- [x] T003 [P] Add a Vitest project/config entry so everything under `test/engine/**` runs with `environment: 'node'` in [vite.config.ts](../../vite.config.ts)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The engine core, ports, worker protocol, store, and legacy-removal that every user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Define shared engine types and port interfaces (`SimRole`, `SimTopology`, `MetricsWindow`, `NodeMetrics`, `EdgeMetrics`, `TopologyPort`, `TrafficSourcePort`, `MetricsSinkPort`, `Simulation`, `CycleError`) in `src/engine/ports.ts`
- [x] T005 [P] Implement a binary-heap future-event queue (schedule/pop-min by virtual time) in `src/engine/eventQueue.ts`
- [x] T006 [P] Implement a seedable PRNG (mulberry32) and exponential inter-arrival sampler implementing `TrafficSourcePort` in `src/engine/poisson.ts`
- [x] T007 [P] Implement the bounded logistic throughput→animation mapping (`mapThroughputToAnimation`, explicit `mappingConfig` argument) in `src/engine/sigmoidMapping.ts`
- [x] T008 Implement per-window metrics aggregation (accumulate departures/queue depth, flush a `MetricsWindow` every `windowSizeMs`) in `src/engine/metrics.ts` (depends on T004)
- [x] T009 Implement generator / placeholder-processor / sink component behaviors, the topology graph builder (fan-out split, fan-in sum), and cycle detection in `src/engine/components.ts` (depends on T004, T005, T006)
- [x] T010 Implement `createSimulation(trafficSource, metricsSink, windowSizeMs)` — the DES loop with `loadTopology`/`start`/`pause`/`reset`/`tick` — in `src/engine/simulation.ts` (depends on T004, T005, T008, T009)
- [x] T011 [P] Define the worker protocol discriminated unions (`ToWorker`, `FromWorker`) in `src/sim/workerProtocol.ts` (depends on T004)
- [x] T012 Implement the Zustand vanilla store (nodes, edges, run status, latest `MetricsWindow`, actions) with a `useStore` hook wrapper in `src/sim/store.ts` (depends on T011)
- [x] T013 Remove the legacy export pipeline: delete `src/lab/ExportBar.tsx`, `src/lab/exportSvg.ts`, `src/lab/exportComponentCode.ts`, `src/lab/exportBundle.ts`, `src/lab/exportGeometry.ts`, `src/lab/promptTemplate.ts`, `src/lab/useExportActions.ts` and their imports/usages in `src/App.tsx`
- [x] T014 [P] Add a pre-pivot diagram fixture at `test/fixtures/legacy-diagram.json` (a diagram.json shape with no `data.sim` on any node, matching the pre-008 export shape)

**Checkpoint**: Engine core, ports, worker protocol, store, and legacy removal are done — user stories can now be implemented.

---

## Phase 3: User Story 1 - Run a simulation on a simple topology (Priority: P1) 🎯 MVP

**Goal**: Build generator → processor → sink, set rates, press Start, watch edges animate and the queue congest/drain.

**Independent Test**: Build the three-node topology, set generator rate above/below the processor's service rate, press Start, and observe edge animation plus growing/draining queue depth (asserted via engine unit tests and the quickstart manual walkthrough steps 1–4).

### Tests for User Story 1

- [x] T015 [P] [US1] Unit tests for future-event queue ordering (schedule/pop-min, ties, empty) in `test/engine/eventQueue.test.ts`
- [x] T016 [P] [US1] Unit tests for the seeded Poisson sampler (deterministic given seed, mean inter-arrival converges to `1/λ`) in `test/engine/poisson.test.ts`
- [x] T017 [P] [US1] Unit tests for generator/processor/sink behaviors and cycle detection (rejects cyclic topology, allows acyclic) in `test/engine/components.test.ts`
- [x] T018 [P] [US1] Unit tests for simulation lifecycle: `start`/`pause`/`reset`/`tick`, no-generator guard, cycle-at-start rejection, steady-state throughput within 5% of `min(rate, serviceRate)` (SC-003) in `test/engine/simulation.test.ts`
- [x] T019 [P] [US1] Unit tests for `mapThroughputToAnimation` bounds (never outside `[0.4, 6.0]` duration / `[0,1]` density, monotonic in log-throughput) in `test/engine/sigmoidMapping.test.ts`

### Implementation for User Story 1

- [x] T020 [US1] Add simulation-role fields to `src/lab/Inspector.tsx`: role selector (generator/processor/sink) plus rate / service-rate inputs with inline validation (`ratePerSec ≥ 0`, `serviceRatePerSec > 0`, rejected not clamped) (depends on T004)
- [x] T021 [US1] Implement `src/sim/simWorker.ts`: hosts `createSimulation`, wires the Poisson `TrafficSourcePort` and a `MetricsSinkPort` that posts `{type:'window'}`, handles `init`/`start`/`pause`/`reset`/`updateTopology`, drives `tick` off a 200 ms `setInterval` (depends on T006, T009, T010, T011)
- [x] T022 [US1] Implement `src/sim/useSimulation.ts`: creates/terminates the worker, sends `ToWorker` messages, intakes `FromWorker` messages into the store (depends on T012, T021)
- [x] T023 [US1] Implement `src/lab/SimulationControls.tsx`: persistent Start/Pause/Reset bar, surfaces the no-generator guard message and cycle-rejection message from `status: 'error'` (depends on T022)
- [x] T024 [US1] Wire `src/lab/HeatEdge.tsx` to read `data.simMetrics.throughputPerSec`, call `mapThroughputToAnimation`, and apply `--sim-flow-duration`/`--sim-flow-dash` as inline CSS variables consumed by the existing `heat-flow` animation (depends on T007)
- [x] T025 [US1] Add a store selector/derivation that builds `SimTopology` from store nodes/edges (only nodes carrying `data.sim`) for `init`/`updateTopology` messages, in `src/sim/store.ts` (depends on T012)
- [x] T026 [US1] Rewire `src/App.tsx`: replace `ExportBar` with `SimulationControls`, mount the Zustand store and `useSimulation`, merge each window's `simMetrics` onto rendered nodes/edges (depends on T020, T021, T022, T023, T024, T025)

**Checkpoint**: User Story 1 is fully functional and independently testable — the three-node topology animates and congests/drains per the acceptance scenarios.

---

## Phase 4: User Story 2 - Inspect live metrics for a selected node (Priority: P2)

**Goal**: Selecting a node while a simulation runs shows its live throughput/queue depth in the Inspector, with placeholder processors explicitly labeled.

**Independent Test**: Run the P1 topology, select the processor node, verify the Inspector shows throughput/queue depth consistent with configured rates and updates at a steady cadence; verify the placeholder label; verify values freeze on pause.

### Tests for User Story 2

- [x] T027 [P] [US2] Unit tests for per-window metrics aggregation correctness (throughput ≈ `min(rate, serviceRate)`, queue depth grows when rate > serviceRate and drains when rate < serviceRate) in `test/engine/metrics.test.ts`

### Implementation for User Story 2

- [x] T028 [US2] Add a live throughput/queue-depth readout and a "Placeholder (fixed rate)" label to the processor's Inspector section in `src/lab/Inspector.tsx`, sourced from the selected node's `data.simMetrics`, showing the last-known values while paused (depends on T020, T022)
- [x] T029 [US2] Add a store selector exposing the latest per-node `NodeMetrics` for a given node id in `src/sim/store.ts` (depends on T012, T025)

**Checkpoint**: User Stories 1 and 2 both work independently — live numeric metrics appear and freeze correctly.

---

## Phase 5: User Story 3 - Configure simulation nodes and persist the topology (Priority: P3)

**Goal**: Round-trippable topology JSON carrying simulation roles/rates (never live metrics), backward-compatible with pre-pivot diagrams, plus safe editing/deletion while a simulation runs.

**Independent Test**: Configure rates, export JSON, reload, re-import, confirm identical topology/config and zeroed metrics; import `test/fixtures/legacy-diagram.json` and confirm it loads as a plain (non-simulating) diagram.

### Tests for User Story 3

- [x] T030 [P] [US3] Round-trip tests: `data.sim` (generator/processor/sink + rates) survives serialize/parse, `data.simMetrics`/edge `simMetrics` are never serialized, extending `test/lab/exportDiagram.test.ts`
- [x] T031 [P] [US3] Legacy-import test using `test/fixtures/legacy-diagram.json` — loads without error, all nodes parse with no `sim` role, extending `test/lab/exportDiagram.test.ts`

### Implementation for User Story 3

- [x] T032 [US3] Extend `src/lab/exportDiagram.ts`'s whitelist (`toPlainDiagram`/`parsePlainNode`) to serialize/parse `data.sim`, excluding `data.simMetrics` and edge `simMetrics`; nodes with no `sim` payload parse as plain diagram nodes (depends on T014)
- [x] T033 [US3] On topology import, reset run status, virtual time, and all `simMetrics` to their initial state in `src/sim/store.ts` (depends on T012)
- [x] T034 [US3] Implement the auto-pause-on-structural-edit-while-running path: node/edge add/delete while `running` sends `updateTopology`, the worker replies `status:'paused'` with a message, and `SimulationControls` surfaces that notice, across `src/sim/store.ts`, `src/sim/useSimulation.ts`, `src/lab/SimulationControls.tsx` (depends on T022, T023, T025)

**Checkpoint**: All three user stories are independently functional — the walking skeleton is complete end to end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification sweep across the whole feature.

- [x] T035 [P] Run `npm run lint` and fix any violations, confirming the `src/engine/**` purity override (T002) actually fires on a deliberately-introduced bad import, then remove the deliberate violation
- [x] T036 [P] Run `npm run build` (`tsc -b && vite build`) and fix any type errors across `src/engine/`, `src/sim/`, `src/lab/`
- [x] T037 Execute the [quickstart.md](../008-simulation-engine-skeleton/quickstart.md) manual walkthrough end to end (all 8 steps) and fix any discrepancies found
- [x] T038 [P] Run `npm run test` and confirm the full suite (existing `test/lab/**` plus new `test/engine/**`/`test/sim/**`/`test/lab/**` additions) passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — can start immediately
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: depends on Foundational only
- **User Story 2 (Phase 4)**: depends on Foundational; builds on US1's Inspector role fields (T020) and worker wiring (T022) but is a separate, additive Inspector section
- **User Story 3 (Phase 5)**: depends on Foundational; builds on US1's store/worker wiring (T022, T025) and the legacy fixture (T014)
- **Polish (Phase 6)**: depends on all three user stories being complete

### Within Each User Story

- Tests are written first and should fail before their corresponding implementation task lands
- Engine primitives (queue, PRNG, sigmoid) before components; components before the simulation loop; simulation loop before the worker; worker before the hook; hook before UI wiring

### Parallel Opportunities

- T002, T003 in parallel (Setup)
- T005, T006, T007 in parallel (Foundational — independent engine primitives); T011, T014 in parallel with those
- T015–T019 in parallel (US1 tests, different files)
- T027 can run alongside US1 tests once T008 lands
- T030, T031 in parallel (US3 tests, same file but independent cases — coordinate if conflicts arise)
- T035, T036, T038 in parallel (Polish)

---

## Parallel Example: User Story 1 tests

```bash
# Launch all US1 engine tests together:
Task: "Unit tests for future-event queue ordering in test/engine/eventQueue.test.ts"
Task: "Unit tests for the seeded Poisson sampler in test/engine/poisson.test.ts"
Task: "Unit tests for generator/processor/sink behaviors and cycle detection in test/engine/components.test.ts"
Task: "Unit tests for simulation lifecycle in test/engine/simulation.test.ts"
Task: "Unit tests for mapThroughputToAnimation bounds in test/engine/sigmoidMapping.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational — CRITICAL, blocks everything)
2. Complete Phase 3 (User Story 1)
3. **STOP and VALIDATE**: run the quickstart steps 1–4 and the US1 unit suite independently
4. Demo the walking skeleton

### Incremental Delivery

1. Setup + Foundational → engine core, store, worker protocol, legacy removal done
2. Add User Story 1 → test independently → MVP demo
3. Add User Story 2 → test independently → richer demo
4. Add User Story 3 → test independently → full feature complete
5. Polish sweep (lint/build/quickstart/full test run)
