
---

description: "Task list for Kafka Simulation UI"
---

# Tasks: Kafka Simulation UI

**Input**: Design documents from `/specs/010-kafka-simulation-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/kafka-ui-contract.md, quickstart.md

**Tests**: Included — FR-002/SC-002 explicitly require a validation test matrix, Principle II/SC-004 require the fixture's formula/source data to be verifiably consistent, and Principle VI requires unit tests for all new pure logic.

**Organization**: Tasks are grouped by user story (spec.md P1/P1/P2/P2) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1/US2/US3/US4)

## Path Conventions

Single Vite SPA. `src/engine/` (pure TS contract additions), `src/lab/`
(UI), `test/engine/`, `test/lab/`, `test/fixtures/`.

No Setup phase: this feature adds no new dependencies and no new tooling —
the existing `src/engine/**` oxlint purity override and Vitest `node`
environment (feature 008) already cover every new file below.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The shared contract types, static catalogs, fixture, and
resolver every user story reads from.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 [P] Define `KafkaStatus`, `BindingConstraint`, `KafkaNodeMetrics`, `FormulaSource`, `FormulaDescriptor` in `src/engine/kafkaContracts.ts` (contracts/kafka-ui-contract.md)
- [ ] T002 [P] Define the `HardwareProfile` type and static `HARDWARE_PROFILES` catalog (~5 entries: id, label, vCpu, ramGB, networkGbps, diskType, diskIops) in `src/engine/hardwareProfiles.ts`
- [ ] T003 [P] Implement `convertReqPerSecToMBPerSec(reqPerSec, avgPayloadBytes)` in `src/engine/unitConversion.ts`
- [ ] T004 Add `kafka`/`producer`/`consumer` `SimRole` variants (`hardwareProfileId`, `partitions`, `replicationFactor`, `tlsEnabled`, `compression`, `retentionHours` / `ratePerSec`, `avgPayloadBytes` / `capacityPerSec`) to the `SimRole` union in `src/engine/ports.ts` (depends on T002)
- [ ] T005 Add optional `kafka?: KafkaNodeMetrics` and `formulas?: FormulaDescriptor[]` fields to `NodeMetrics` in `src/engine/ports.ts` (depends on T001)
- [ ] T006 [P] Implement pure per-field validators (partitions/replicationFactor/retentionHours integer/positivity rules; producer `ratePerSec`/`avgPayloadBytes`; consumer `capacityPerSec`), each returning `{ value }` or `{ error }`, in `src/lab/kafkaRoleValidation.ts` (depends on T004)
- [ ] T007 Implement the static `KAFKA_FIXTURE: Record<string, { metrics: KafkaNodeMetrics; formulas: FormulaDescriptor[] }>` covering 5 regimes (`healthy-kafka`, `network-saturated-kafka`, `cpu-saturated-kafka`, `disk-cliff-kafka`, `degraded-kafka`) in `src/lab/kafkaFixture.ts` (depends on T001)
- [ ] T008 Implement `resolveKafkaMetrics(nodeId, latestWindow)` and `resolveFormulas(nodeId, latestWindow)` in `src/lab/kafkaNodeData.ts` (live window field, else `KAFKA_FIXTURE`, else `undefined`/`[]`) (depends on T005, T007)
- [ ] T009 [P] Implement `applyStatusTreatment(existingClassName, status)` in `src/lab/kafkaStatusTreatment.ts`, following the exact idempotent-strip-then-apply pattern already used by `withHandlesVisibleClass` (`src/lab/useHandleVisibility.ts`) (depends on T001)
- [ ] T010 [P] Add `test/fixtures/kafka-demo-topology.json`: 5 `kafka`-role nodes whose ids match `KAFKA_FIXTURE`'s keys, plus one connected `producer` node, importable via the existing topology-import feature (depends on T007)

**Checkpoint**: Contract types, catalog, validators, fixture, and resolver are done — user stories can now be implemented.

---

## Phase 2: User Story 1 - Configure a Kafka topology from the Inspector (Priority: P1) 🎯 MVP

**Goal**: Assign kafka/producer/consumer roles from the Inspector, fill every field with the hardware profile picker visible, reject invalid values inline, round-trip through export/import.

**Independent Test**: assign each of the three roles, fill every field, enter invalid values (zero payload, negative rate, blank partition count) and verify inline rejection; export/import the topology JSON and verify the configuration survives.

### Tests for User Story 1

- [ ] T011 [P] [US1] Unit test matrix for every validator in `kafkaRoleValidation.ts` (each field: valid values accepted, invalid values rejected with a specific message, never clamped) in `test/lab/kafkaRoleValidation.test.ts` (SC-002)
- [ ] T012 [P] [US1] Round-trip tests: `kafka`/`producer`/`consumer` `SimRole` variants survive serialize/parse with the exact same field values, in `test/lab/exportDiagram.test.ts`

### Implementation for User Story 1

- [ ] T013 [US1] Add `kafka`/`producer`/`consumer` to the role choice list in `src/lab/Inspector.tsx`'s `SimRoleFields` (or split into per-role field components alongside it), wiring each numeric/boolean/select field to its `kafkaRoleValidation.ts` validator with the existing draft-text-state + inline-error pattern (depends on T006, T013's role list depends on T004)
- [ ] T014 [US1] Add the hardware profile picker to the `kafka` role's Inspector fields, listing each `HARDWARE_PROFILES` entry with vCPU/RAM/network/disk specs visible, storing only the chosen `hardwareProfileId` (depends on T002, T013)
- [ ] T015 [US1] Extend `src/lab/exportDiagram.ts`'s whitelist (`toPlainDiagram`/`parsePlainNode`) to serialize/parse the new `SimRole` variants' fields (depends on T004)

**Checkpoint**: User Story 1 is fully functional and independently testable — Kafka/producer/consumer configuration works end to end with inline validation and round-trip.

---

## Phase 3: User Story 2 - Read the cluster's health at a glance (Priority: P1)

**Goal**: Selecting a Kafka node shows live ingress/egress, three saturation meters, consumer lag, page-cache hit ratio, and a status badge, with the binding constraint visually distinguished.

**Independent Test**: with fixture data (pre-009) or a live run (post-009), drive each of the three metric regimes and verify the meters, badge, and binding-constraint highlight update accordingly at the metric-window cadence.

### Tests for User Story 2

- [ ] T016 [P] [US2] Unit tests for `resolveKafkaMetrics`/`resolveFormulas` precedence (live field wins when present, fixture fallback when absent, `undefined`/`[]` for unknown node ids) in `test/lab/kafkaNodeData.test.ts`
- [ ] T017 [P] [US2] Fixture self-check tests: every `KAFKA_FIXTURE` entry has ≥1 `FormulaSource` per formula and its `status`/`bindingConstraint` agrees with exactly the `formulas[].binding` flags tied to that resource, in `test/lab/kafkaFixture.test.ts`

### Implementation for User Story 2

- [ ] T018 [US2] Add the Kafka metrics readout to `src/lab/Inspector.tsx`'s node branch — ingress/egress throughput, network/CPU/disk saturation meters, consumer lag, page cache hit ratio, and the healthy/saturated/degraded status badge — sourced from `resolveKafkaMetrics(selectedNode.id, latestWindow)`, rendering `—` when `undefined` (depends on T008, T013)
- [ ] T019 [US2] Visually distinguish the binding constraint in the metrics readout (e.g. highlighted meter + label matching `bindingConstraint`) (depends on T018)

**Checkpoint**: User Stories 1 and 2 both work independently — Kafka nodes can be configured and their live/fixture health read from the Inspector.

---

## Phase 4: User Story 3 - See system stress on the canvas itself (Priority: P2)

**Goal**: Saturated/degraded nodes carry a token-derived status treatment on the canvas; producer→kafka edges show both req/s and MB/s.

**Independent Test**: run a topology into saturation (or select fixture nodes) and verify the affected node's status treatment appears/clears as status changes; hover or inspect a converting edge and verify both units are shown with consistent values (MB/s = req/s × payload).

### Tests for User Story 3

- [ ] T020 [P] [US3] Unit tests for `applyStatusTreatment` idempotency (repeated calls never duplicate the class token; switching status replaces rather than appends; `healthy`/`undefined` clears any existing treatment) in `test/lab/kafkaStatusTreatment.test.ts`
- [ ] T021 [P] [US3] Unit tests for `convertReqPerSecToMBPerSec` (known values, zero payload, zero rate) in `test/engine/unitConversion.test.ts`

### Implementation for User Story 3

- [ ] T022 [US3] Apply `applyStatusTreatment` to each rendered node's `className` in `src/App.tsx`'s `renderedNodes` `useMemo`, reading `resolveKafkaMetrics(node.id, latestWindow)?.status`, following the same idempotent-recompute pattern already used for `withHandlesVisibleClass` in that same block (depends on T009, T008)
- [ ] T023 [US3] Add the status badge (text, not color-only) alongside the label in `src/lab/LabelNode.tsx`, sourced from the node's resolved status (depends on T022)
- [ ] T024 [US3] Compute dual-unit display data for producer→kafka edges — `convertReqPerSecToMBPerSec` fed by the source node's `avgPayloadBytes` and the edge's resolved req/s throughput — and merge it into each edge's `data` in `src/App.tsx`'s `renderedEdges` `useMemo`, alongside the existing `simMetrics` merge (depends on T003, T004)
- [ ] T025 [US3] Render both units on the edge in `src/lab/HeatEdge.tsx` when dual-unit data is present (depends on T024)

**Checkpoint**: User Stories 1–3 all work independently — the canvas itself now shows stress and dual-unit edges.

---

## Phase 5: User Story 4 - Audit the formulas behind the numbers (Priority: P2)

**Goal**: The bottom of the Inspector shows every active formula for the selected node with its expression, inputs, binding highlight, source links, and the standing directional-accuracy disclaimer — or an explanation when none apply.

**Independent Test**: select nodes in different regimes (fixture or live) and verify the panel lists the active formulas with non-empty expressions and ≥1 source link each, highlights the binding one, updates when the regime changes, and displays the directional-accuracy disclaimer.

### Tests for User Story 4

- [ ] T026 [P] [US4] Unit tests confirming `FormulaPanel`'s no-formulas explanatory copy is chosen for `formulas.length === 0` and the standing disclaimer text is always present, in `test/lab/FormulaPanel.test.ts` (as a pure "view-model" function, e.g. `describeFormulaPanelState(formulas)`, kept separate from JSX per Principle VI's pure-logic testing split)

### Implementation for User Story 4

- [ ] T027 [US4] Implement `src/lab/FormulaPanel.tsx`: renders each `FormulaDescriptor` (name, expression, `inputs` as key/value list, binding highlight) with its `sources` as `<a target="_blank" rel="noopener noreferrer">` links, the standing directional-accuracy disclaimer in every state, and the no-formulas explanatory sentence for empty/placeholder/no-role nodes (depends on T008)
- [ ] T028 [US4] Mount `FormulaPanel` at the bottom of `src/lab/Inspector.tsx`'s node branch, below the role/metrics fields, passing `resolveFormulas(selectedNode.id, latestWindow)` (depends on T018, T027)

**Checkpoint**: All four user stories are independently functional — the Kafka Simulation UI is complete end to end on the static fixture.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification sweep across the whole feature.

- [ ] T029 [P] Run `npm run lint` and fix any violations, confirming `src/engine/kafkaContracts.ts`, `hardwareProfiles.ts`, and `unitConversion.ts` stay clean under the existing `src/engine/**` purity override
- [ ] T030 [P] Run `npm run build` (`tsc -b && vite build`) and fix any type errors across `src/engine/`, `src/lab/`
- [ ] T031 Execute the [quickstart.md](../010-kafka-simulation-ui/quickstart.md) manual walkthrough end to end (all 9 steps) and fix any discrepancies found
- [ ] T032 [P] Run `npm run test` and confirm the full suite (existing tests plus all new `test/engine/**`/`test/lab/**` additions) passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: no dependencies — BLOCKS all user stories
- **User Story 1 (Phase 2)**: depends on Foundational only
- **User Story 2 (Phase 3)**: depends on Foundational; builds on US1's Inspector role fields (T013) but is a separate, additive Inspector section
- **User Story 3 (Phase 4)**: depends on Foundational; builds on US1's role config (T004) and US2's resolver usage pattern (T008), but touches different files (`App.tsx`, `LabelNode.tsx`, `HeatEdge.tsx`)
- **User Story 4 (Phase 5)**: depends on Foundational; builds on US2's Inspector mounting point (T018) but is an independent component
- **Polish (Phase 6)**: depends on all four user stories being complete

### Within Each User Story

- Tests are written first and should fail before their corresponding implementation task lands
- Contract types/catalog before validators/fixture; validators and fixture before the resolver; resolver before any UI consumer

### Parallel Opportunities

- T001, T002, T003 in parallel (Foundational — independent contract/catalog/conversion modules)
- T009, T010 in parallel with the above once their dependencies (T001/T007) land
- T011, T012 in parallel (US1 tests, different files)
- T016, T017 in parallel (US2 tests, different files)
- T020, T021 in parallel (US3 tests, different files)
- T029, T030, T032 in parallel (Polish)

---

## Parallel Example: Foundational contract modules

```bash
# Launch the independent contract/catalog modules together:
Task: "Define KafkaNodeMetrics/FormulaDescriptor types in src/engine/kafkaContracts.ts"
Task: "Define HARDWARE_PROFILES catalog in src/engine/hardwareProfiles.ts"
Task: "Implement convertReqPerSecToMBPerSec in src/engine/unitConversion.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Foundational — CRITICAL, blocks everything)
2. Complete Phase 2 (User Story 1)
3. **STOP and VALIDATE**: run the quickstart steps 1–3 and the US1 unit suite independently
4. Demo Kafka/producer/consumer configuration

### Incremental Delivery

1. Foundational → contract types, catalog, validators, fixture, resolver done
2. Add User Story 1 → test independently → configuration demo
3. Add User Story 2 → test independently → live health readout demo
4. Add User Story 3 → test independently → canvas-as-dashboard demo
5. Add User Story 4 → test independently → full feature complete
6. Polish sweep (lint/build/quickstart/full test run)
