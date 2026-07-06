# Tasks: Generalized Host/Queue Simulation Model

**Input**: Design documents from `/specs/011-host-queue-model/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/engine-ports.md, quickstart.md

**Tests**: Included — constitution VI mandates unit tests for every engine formula, conversion, and serialization change; UI is manual smoke per quickstart.md.

**Organization**: Tasks grouped by user story. US1+US2 together form the MVP. Constitution note: formula descriptors (Phase 7) MUST land before the feature PR merges (Principle II), even though they are staged as US5.

## Phase 1: Setup

- [ ] T001 Add host/queue/edge tunables to `src/engine/config.ts`: `HOST_RHO_CLAMP` (0.99), `HOST_SATURATION_THRESHOLD`, `EDGE_CONGESTION_THRESHOLD`, KB→MB and MB→GB unit constants; keep `KAFKA_*` constants for now (removed in T004)

## Phase 2: Foundational (blocking all user stories)

**Purpose**: Swap the port payload types, remove the retired Kafka model, and give the graph a propagation order — the build must be green again by the end of this phase.

- [ ] T002 Replace `SimRole` with `HostNodeSim | QueueNodeSim` and add `EdgeSimConfig` on topology edges in `src/engine/ports.ts`; revise `NodeMetrics`/`EdgeMetrics` to the data-model.md shapes (`host?`, `queue?`, `sim?`); keep `FormulaDescriptor`/`FormulaSource`/`CycleError` and the three port interfaces unchanged
- [ ] T003 Update `src/engine/components.ts`: keep `buildTopologyGraph` + `detectCycle`; add Kahn topological ordering (stored on `TopologyGraph`) and per-source `trafficShareRatio` normalization; retarget generator batch-mode helpers at client-pool hosts; drop `drainProcessorBacklog` and producer payload validation (superseded); update `test/engine/components.test.ts`
- [ ] T004 Remove the deep Kafka engine model: delete `src/engine/kafka/` and `test/engine/kafka/`; delete `KAFKA_*` constants from `src/engine/config.ts`; strip `computeKafkaWindowMetrics`/`ensureKafkaRuntimes`/`kafkaRuntimes` wiring from `src/engine/simulation.ts`
- [ ] T005 Remove Kafka lab modules and their tests: `src/lab/kafkaConfigFields.tsx`, `src/lab/kafkaRoleValidation.ts`, `src/lab/kafkaBindingResource.ts`, `src/lab/kafkaStatusTreatment.ts`, `src/lab/KafkaMetricsPanel.tsx`, `test/lab/kafkaBindingResource.test.ts`, `test/lab/kafkaRoleValidation.test.ts`, `test/lab/kafkaStatusTreatment.test.ts`; remove their imports/usages from `src/lab/Inspector.tsx`, `src/lab/useDiagramMutations.ts`, `src/lab/FormulaPanel.tsx`, `src/lab/formulaPanelState.ts`, `src/lab/LabelNode.tsx`, `src/lab/NodeInfoButton.tsx` (leave temporary stubs where new host UI lands in later phases)
- [ ] T006 Update sim adapters to the new payload types in `src/sim/workerProtocol.ts`, `src/sim/simWorker.ts`, `src/sim/useSimulation.ts`, `src/sim/store.ts` — message kinds and windowing unchanged (contract: only payload types evolve)
- [ ] T007 Import sanitization per research D7 in `src/lab/exportDiagram.ts`: retired-role nodes (`generator/processor/producer/consumer/sink/kafka`) degrade to plain visual nodes on import with a one-time notice; serialize new `sim`/edge-config shapes; update `test/lab/exportDiagram.test.ts` with an old-JSON fixture

**Checkpoint**: `npm run build`, `npm run lint`, `npm run test` green with the old model gone (simulation temporarily emits throughput-only windows).

## Phase 3: User Story 1 — Model a service chain and watch it saturate (P1)

**Goal**: client pool → API → DB chain shows saturation ordering, smooth hockey-stick latency, congestion-red edges.
**Independent test**: sweep client RPS 100 → 480 → 500+ against a 500 req/s API host; verify saturation ≈ ρ, continuous latency growth, red inbound edges past the congestion threshold, finite numbers when overloaded.

- [ ] T008 [P] [US1] Create `src/engine/hostModel.ts`: manual-mode capacity/ρ, `latencyMs = base × (1 + ρ/(1−ρ))` with `HOST_RHO_CLAMP` (research D2), `manualMaxRPS` forward-clamp + `shedRPS` (D6), external-api (ρ=0, baseline latency) and client-pool (emit `requestRatePerSec`) behavior, status derivation (`healthy/saturated/overloaded`); zero-capacity inputs yield zeros, never NaN
- [ ] T009 [P] [US1] Create `test/engine/hostModel.test.ts`: exact values at known operating points (ρ=0.2 ⇒ ~baseline; ρ=0.95 ⇒ ≥5× baseline per SC-002), strict monotonic continuity across a 10%→99% sweep (no step at any threshold), clamp finiteness above capacity, maxRPS shedding, external-api and zero-capacity edge cases
- [ ] T010 [US1] Create `src/engine/flowPropagation.ts`: per-window topological pass (research D1/D5) — client pools emit windowed rate, edges carry `sourceOutputRPS × normalizedShare`, hosts compute metrics via `hostModel`, edge `isCongested` from target saturation (`EDGE_CONGESTION_THRESHOLD`); returns node/edge metrics maps for the window
- [ ] T011 [US1] Create `test/engine/flowPropagation.test.ts`: 3-host chain propagation order, fan-out share splits, congestion flag ordering (first bottleneck saturates first), disconnected-node zeros, shed traffic not forwarded
- [ ] T012 [US1] Rewire `src/engine/simulation.ts`: window flush calls `flowPropagation` (replacing the removed Kafka merge); client-pool arrivals keep flowing through the Poisson event queue into the windowed rate; delete processor/sink runtime paths; update `test/engine/simulation.test.ts`
- [ ] T013 [P] [US1] Create `src/lab/hostStatusTreatment.ts` (+ `test/lab/hostStatusTreatment.test.ts`): map `HostNodeMetrics.status` to the canvas node treatment vocabulary (replaces the deleted kafkaStatusTreatment)
- [ ] T014 [US1] Congested-edge red treatment in `src/lab/HeatEdge.tsx` (and `src/lab/edgeStyle.ts`/`src/lab/heatVariants.ts` as needed) driven by per-window `EdgeSimMetrics.isCongested`; animation speed still rides the existing sigmoid pipeline off edge throughput
- [ ] T015 [US1] Read-only host telemetry in `src/lab/Inspector.tsx`: incoming RPS, saturation %, latency ms, shed RPS, status for the selected host (config editing arrives in US2)
- [ ] T016 [US1] New starter topology in `src/lab/initialDiagram.ts`: client pool (100 req/s) → transactional API (manual, 500 req/s saturation) → database host, with explicit `EdgeSimConfig` values on every edge (no defaults — CLAUDE.md)

**Checkpoint**: quickstart P1 walkthrough steps 1–4 pass on the canvas.

## Phase 4: User Story 2 — Dual config modes (P1)

**Goal**: manual and calculated modes configurable in the Inspector and agreeing on the saturation point.
**Independent test**: manual host (500 req/s saturation) vs calculated host (16 ms × 8 threads = 500 req/s) saturate at the same offered load within 1% (SC-003); inbound compute-weight multipliers skew ρ proportionally.

- [ ] T017 [US2] Extend `src/engine/hostModel.ts` with calculated mode (research D3): `capacityRPS = maxWorkerThreads / (cpuProcessingTimeMs/1000)`, ρ weighted by traffic-weighted mean of inbound `targetComputeWeightMultiplier`, base latency = `cpuProcessingTimeMs` + traffic-weighted mean of outbound `pathIoLatencyMs`
- [ ] T018 [P] [US2] Extend `test/engine/hostModel.test.ts`: manual/calculated equivalence within 1% (SC-003), weighted-multiplier proportionality (spec US2 scenario 3), calculated base-latency composition, 0-thread edge case
- [ ] T019 [US2] Create `src/lab/hostConfigFields.tsx`: Inspector config UI for hosts — profile selector, manual/calculated mode toggle, and exactly the FR-020 fields per profile/mode (client pool: `requestRatePerSec`; external api: `manualBaselineLatencyMs`; manual: the three `manual*` fields with `manualMaxRPS ≥ manualSaturationRPS` validation; calculated: `cpuProcessingTimeMs`, `maxWorkerThreads`) — no other inputs (SC-008)
- [ ] T020 [US2] Wire host config mutations through `src/lab/useDiagramMutations.ts` and mount `hostConfigFields` in `src/lab/Inspector.tsx`; live topology update via the existing `updateTopology` path; update `test/lab/useDiagramMutations.test.ts`

**Checkpoint**: quickstart steps 5 passes — MVP complete (US1+US2).

## Phase 5: User Story 3 — Generic queue backlog (P2)

**Goal**: queue node absorbs producer/consumer imbalance; backlog grows and drains; zero config surface.
**Independent test**: 20 MB/s in vs 10 MB/s drained ⇒ ~0.6 GB backlog after 60 simulated seconds (±5%, SC-004); backlog drains monotonically to 0 and never goes negative.

- [ ] T021 [P] [US3] Create `src/engine/queueModel.ts`: per-window inflow (MB/s via edge payload), outflow = `min(desired-by-consumers, inflow + backlog/windowSec)` with desired derived from downstream host remaining capacity (research D4), backlog integration floored at 0; backlog is the only cross-window state (reset on `reset()`)
- [ ] T022 [P] [US3] Create `test/engine/queueModel.test.ts`: SC-004 accumulation accuracy, monotonic drain, never-negative floor, no-consumer unbounded growth stays finite over long runs, RPS↔MB/s conversion via payload size
- [ ] T023 [US3] Integrate queues into `src/engine/flowPropagation.ts` (queue pass in topological order, queue runtime map plumbed from `src/engine/simulation.ts`); extend `test/engine/flowPropagation.test.ts` with host→queue→host scenarios
- [ ] T024 [US3] Queue telemetry section in `src/lab/Inspector.tsx` (inflow/outflow MB/s, backlog GB) with **no** config fields (FR-010/SC-008); queue node kind available from `src/lab/Sidebar.tsx` palette

## Phase 6: User Story 4 — Shape traffic on edges (P2)

**Goal**: edge config editable; edge telemetry (RPS, MB/s, active connections) live.
**Independent test**: 1,000 req/s fanned 0.7/0.3 ⇒ 700/300 req/s per edge; 100 req/s × 50 KB ⇒ ≈4.88 MB/s; 200 req/s × 250 ms ⇒ ≈50 connections.

- [ ] T025 [P] [US4] Edge telemetry in `src/engine/flowPropagation.ts`: `currentMBps = currentRPS × payloadKB / 1024`, `activeConnections = currentRPS × latencySec` (Little's law over target latency + `pathIoLatencyMs`); extend `test/engine/flowPropagation.test.ts` with the three US4 numeric scenarios
- [ ] T026 [US4] Create `src/lab/edgeConfigFields.tsx`: edge config UI for exactly the four `EdgeSimConfig` fields, with a share-normalization hint when a source's outbound shares ≠ 1; mount in `src/lab/Inspector.tsx`/`src/lab/EdgeToolbar.tsx` and wire mutations through `src/lab/useDiagramMutations.ts`
- [ ] T027 [US4] Edge telemetry display (RPS, MB/s, connections, congested badge) in the edge Inspector section of `src/lab/Inspector.tsx`

## Phase 7: User Story 5 — Formulas remain traceable (P3, merge-blocking per constitution II)

**Goal**: every computed host/queue/edge metric ships a sourced `FormulaDescriptor` rendered by the existing formula panel.
**Independent test**: select a saturated host ⇒ saturation + latency formulas with live inputs and ≥1 citation each; select an edge ⇒ Little's law with source.

- [ ] T028 [US5] Create `src/engine/formulaCatalog.ts`: descriptor builders for saturation ρ, hockey-stick latency, capacity-from-threads, maxRPS shed, edge RPS/MBps, Little's law connections, backlog integration — each with structured sources per research D8 (Kleinrock, Little 1961, Denning & Buzen 1978, product data-model for definitional conversions); reuse `validateFormulaDescriptorsHaveSources`
- [ ] T029 [P] [US5] Create `test/engine/formulaCatalog.test.ts`: every descriptor has ≥1 source (SC-005), expressions/inputs match live computation values at a known operating point
- [ ] T030 [US5] Attach descriptors to node and edge metrics in `src/engine/flowPropagation.ts`; verify `src/lab/FormulaPanel.tsx`/`src/lab/formulaPanelState.ts` render host, queue, and edge descriptors (update `test/lab/FormulaPanel.test.ts`)

## Phase 8: Polish & cross-cutting

- [ ] T031 [P] Remove now-dead helpers: `src/lab/dualUnitLabel.ts` + `test/lab/dualUnitLabel.test.ts` if unreferenced; sweep `grep -ri kafka src/ test/` to zero product references (SC-007)
- [ ] T032 [P] Performance sanity per SC-006: 30-node topology at 10,000 req/s aggregate — confirm per-window propagation cost is O(V+E) (no throughput-proportional work) via a windowed-tick benchmark test in `test/engine/flowPropagation.test.ts`
- [ ] T033 Full gate: `npm run lint`, `npm run build`, `npm run test`; manual quickstart.md walkthrough (P1 sweep, mode equivalence, queue backlog, formula panel) and SC-001 five-minute scenario check

## Dependencies

- Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phases 5/6 → Phase 7 → Phase 8
- US3 (Phase 5) and US4 (Phase 6) are independent of each other after US1; both need US1's `flowPropagation`. US4's active-connections math benefits from US2's calculated latency but only needs US1's manual latency to be testable.
- US5 depends on the formulas it documents (US1–US4) but its catalog skeleton (T028) can start once T008/T017 signatures exist. **Must merge with the feature PR** (constitution II).

## Parallel opportunities

- Phase 2: T004, T005 in parallel after T002/T003; T006, T007 in parallel after T002.
- Phase 3: T008+T009 ∥ T013; T014 ∥ T015 ∥ T016 after T010–T012.
- Phase 5 ∥ Phase 6 (different files) after Phase 4.
- T021+T022 ∥ T025 across stories; T029 ∥ T030 after T028.

## Implementation strategy

MVP = Phases 1–4 (US1+US2): the saturation/latency core with both config modes — independently shippable and demoable per quickstart steps 1–5. Then US3 (queues) and US4 (edge shaping) as parallel increments, US5 formula catalog before the PR to dev, Phase 8 gates last.
