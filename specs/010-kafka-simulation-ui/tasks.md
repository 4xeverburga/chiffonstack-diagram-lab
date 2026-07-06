
---

description: "Task list for Kafka Simulation UI"
---

# Tasks: Kafka Simulation UI

**Revised** after merging feature 009 (`009-kafka-simulation-model`) into
this branch. 009 already implements the full engine contract
(`SimRole` kafka/producer/consumer variants, `KAFKA_HARDWARE_PROFILES`,
`NodeMetrics.kafka`/`.formulaDescriptors`, `EdgeMetrics.nativeThroughputPerSec`/
`.throughputMBps`, and topology-JSON serialization) — this cuts the task
list roughly in half versus the original draft: no fixture, no resolver
layer, no duplicate contract types, no `exportDiagram.ts` work.

**Input**: Design documents from `/specs/010-kafka-simulation-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/kafka-ui-contract.md, quickstart.md, and the merged `009-kafka-simulation-model` branch (`src/engine/kafkaCatalog.ts`, `kafkaFormulas.ts`, `kafkaModel.ts`, extended `ports.ts`/`components.ts`/`simulation.ts`/`exportDiagram.ts`)

**Tests**: Included — FR-002/SC-002 explicitly require a validation test matrix, and Principle VI requires unit tests for all new pure logic.

**Organization**: Tasks are grouped by user story (spec.md P1/P1/P2/P2) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1/US2/US3/US4)

## Path Conventions

Single Vite SPA. All new work is in `src/lab/` and `test/lab/`, plus one
wiring point in `src/App.tsx`. **No `src/engine/` changes** — 009 already
owns that layer.

No Setup phase: this feature adds no new dependencies and no new tooling.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The three small pure UI-side modules every user story reads from.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 [P] Implement pure per-field validators (`validatePartitions`, `validateReplicationFactor`, `validateRetentionBytes`, `validateProducerRate`, `validateAveragePayloadBytes`, `validateConsumeRate`; each returns `{ value }` or `{ error }`, rules mirroring 009's own engine-side checks) in `src/lab/kafkaRoleValidation.ts`
- [ ] T002 [P] Implement `deriveBindingResource(formulaDescriptors)` — scans `FormulaDescriptor[]` ids (`kafka.disk-cliff.*` wins if binding, else whichever of `kafka.network/cpu/disk.ingress-ceiling` is binding) and returns `'network' | 'cpu' | 'disk' | undefined` — in `src/lab/kafkaBindingResource.ts`
- [ ] T003 [P] Implement `applyKafkaStatusClass(existingClassName, status)` in `src/lab/kafkaStatusTreatment.ts`, following the exact idempotent-strip-then-apply pattern already used by `withHandlesVisibleClass` (`src/lab/useHandleVisibility.ts`)

**Checkpoint**: Validators, binding-resource derivation, and status-treatment derivation are done — user stories can now be implemented.

---

## Phase 2: User Story 1 - Configure a Kafka topology from the Inspector (Priority: P1) 🎯 MVP

**Goal**: Assign kafka/producer/consumer roles from the Inspector, fill every field with the hardware profile picker visible, reject invalid values inline. (Round-trip already works — 009's `exportDiagram.ts` whitelist covers these fields.)

**Independent Test**: assign each of the three roles, fill every field, enter invalid values (zero payload, negative rate, blank partition count) and verify inline rejection; export/import the topology JSON and verify the configuration survives (already covered by 009's `test/lab/exportDiagram.test.ts` — this story only needs to prove the Inspector can produce that config in the first place).

### Tests for User Story 1

- [ ] T004 [P] [US1] Unit test matrix for every validator in `kafkaRoleValidation.ts` (each field: valid values accepted, invalid values rejected with a specific message, never clamped) in `test/lab/kafkaRoleValidation.test.ts` (SC-002)

### Implementation for User Story 1

- [ ] T005 [US1] Add `kafka`, `producer`, `consumer` to `SIM_ROLE_CHOICES` and `simRoleChoice()` in `src/lab/Inspector.tsx`, and add each role's default-on-assignment values (mirroring how `generator`/`processor` already default when first chosen) (depends on T001)
- [ ] T006 [US1] Add the `kafka` role's Inspector fields — hardware profile picker (`Object.values(KAFKA_HARDWARE_PROFILES)`, showing `vcpu`/`ramGiB`/`networkMBps`/`diskMBps`), partitions, replication factor, TLS toggle, compression selector (`none`/`zstd`), retention bytes — each wired to its `kafkaRoleValidation.ts` validator with the existing draft-text-state + inline-error pattern (depends on T001, T005)
- [ ] T007 [P] [US1] Add the `producer` role's Inspector fields (message rate, average payload bytes) and the `consumer` role's field (consume rate), same validation pattern (depends on T001, T005)

**Checkpoint**: User Story 1 is fully functional and independently testable — Kafka/producer/consumer configuration works end to end with inline validation.

---

## Phase 3: User Story 2 - Read the cluster's health at a glance (Priority: P1)

**Goal**: Selecting a Kafka node shows live ingress/egress, three saturation meters, consumer lag, page-cache hit ratio, and a status badge, with the binding constraint visually distinguished.

**Independent Test**: run the live simulation through each regime (healthy, each saturation wall, disk-cliff — quickstart.md steps 4–6) and verify the meters, badge, and binding-constraint highlight update accordingly at the metric-window cadence.

### Tests for User Story 2

- [ ] T008 [P] [US2] Unit tests for `deriveBindingResource` (disk-cliff precedence over ingress-ceiling formulas, each of network/cpu/disk selected correctly, `undefined` when nothing is binding, empty/undefined input) in `test/lab/kafkaBindingResource.test.ts`

### Implementation for User Story 2

- [ ] T009 [US2] Add the Kafka metrics readout to `src/lab/Inspector.tsx`'s node branch — ingress/egress throughput, network/CPU/disk saturation meters, consumer lag (bytes + messages), page cache hit ratio, and the healthy/saturated/degraded status badge — sourced from `selectedNodeMetrics?.kafka` (the existing prop, already `NodeMetrics | undefined`), rendering `—` when `undefined` (depends on T006)
- [ ] T010 [US2] Visually distinguish the binding constraint in the metrics readout using `deriveBindingResource(selectedNodeMetrics?.formulaDescriptors)` (e.g. highlighted meter + label matching the returned resource) (depends on T002, T009)

**Checkpoint**: User Stories 1 and 2 both work independently — Kafka nodes can be configured and their live health read from the Inspector.

---

## Phase 4: User Story 3 - See system stress on the canvas itself (Priority: P2)

**Goal**: Saturated/degraded nodes carry a token-derived status treatment on the canvas; producer/consumer↔kafka edges show both req/s and MB/s (both values already computed by the engine).

**Independent Test**: run a topology into saturation/disk-cliff (quickstart.md steps 5–6) and verify the affected node's status treatment appears/clears as status changes; inspect the producer→kafka edge and verify both units are shown and mutually consistent.

### Tests for User Story 3

- [ ] T011 [P] [US3] Unit tests for `applyKafkaStatusClass` idempotency (repeated calls never duplicate the class token; switching status replaces rather than appends; `healthy`/`undefined` clears any existing treatment) in `test/lab/kafkaStatusTreatment.test.ts`

### Implementation for User Story 3

- [ ] T012 [US3] Apply `applyKafkaStatusClass` to each rendered node's `className` in `src/App.tsx`'s `renderedNodes` `useMemo`, reading `selectNodeMetrics(latestWindow, node.id)?.kafka?.status`, following the same idempotent-recompute pattern already used for `withHandlesVisibleClass` in that same block (depends on T003)
- [ ] T013 [US3] Add the status badge (text, not color-only) alongside the label in `src/lab/LabelNode.tsx`, sourced from the node's resolved status (depends on T012)
- [ ] T014 [US3] Render both units on the edge in `src/lab/HeatEdge.tsx` when `data.simMetrics.nativeThroughputPerSec`/`.throughputMBps` are present (already merged onto every edge's `data` by the existing `selectEdgeMetrics` call in `App.tsx`'s `renderedEdges` `useMemo` — no new computation needed)

**Checkpoint**: User Stories 1–3 all work independently — the canvas itself now shows stress and dual-unit edges.

---

## Phase 5: User Story 4 - Audit the formulas behind the numbers (Priority: P2)

**Goal**: The bottom of the Inspector shows every active formula for the selected node with its expression, inputs, binding highlight, source links, and the standing directional-accuracy disclaimer — or an explanation when none apply.

**Independent Test**: select nodes in different regimes (quickstart.md steps 4–6, 9) and verify the panel lists the active formulas with non-empty expressions and ≥1 source link each, highlights the binding one, updates when the regime changes, and displays the directional-accuracy disclaimer.

### Tests for User Story 4

- [ ] T015 [P] [US4] Unit tests confirming a pure view-model helper (e.g. `describeFormulaPanelState(formulaDescriptors)`) chooses the no-formulas explanatory copy for an empty/undefined list and that the standing disclaimer text is always present, in `test/lab/FormulaPanel.test.ts` (kept separate from JSX per Principle VI's pure-logic testing split)

### Implementation for User Story 4

- [ ] T016 [US4] Implement `src/lab/FormulaPanel.tsx`: renders each `FormulaDescriptor` (name, expression, `inputs` as key/value list, highlight when `isBinding === true` — matching `deriveBindingResource`'s result via T002) with its `sources` as `<a target="_blank" rel="noopener noreferrer">` links, the standing directional-accuracy disclaimer in every state, and the no-formulas explanatory sentence for empty/placeholder/no-role nodes (depends on T002)
- [ ] T017 [US4] Mount `FormulaPanel` at the bottom of `src/lab/Inspector.tsx`'s node branch, below the role/metrics fields, passing `selectedNodeMetrics?.formulaDescriptors` (depends on T009, T016)

**Checkpoint**: All four user stories are independently functional — the Kafka Simulation UI is complete end to end against the real engine.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification sweep across the whole feature.

- [ ] T018 [P] Run `npm run lint` and fix any violations, confirming no `src/lab/` addition accidentally imports from a path the `src/engine/**` purity override would flag
- [ ] T019 [P] Run `npm run build` (`tsc -b && vite build`) and fix any type errors across `src/lab/`
- [ ] T020 Execute the [quickstart.md](../010-kafka-simulation-ui/quickstart.md) manual walkthrough end to end (all 10 steps) and fix any discrepancies found
- [ ] T021 [P] Run `npm run test` and confirm the full suite (009's existing engine tests plus all new `test/lab/**` additions) passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: no dependencies — BLOCKS all user stories
- **User Story 1 (Phase 2)**: depends on Foundational only
- **User Story 2 (Phase 3)**: depends on Foundational; builds on US1's Inspector role fields (T006) but is a separate, additive Inspector section
- **User Story 3 (Phase 4)**: depends on Foundational; builds on US1's role config (T005/T006) but touches different files (`App.tsx`, `LabelNode.tsx`, `HeatEdge.tsx`)
- **User Story 4 (Phase 5)**: depends on Foundational; builds on US2's Inspector mounting point (T009) but is an independent component
- **Polish (Phase 6)**: depends on all four user stories being complete

### Within Each User Story

- Tests are written first and should fail before their corresponding implementation task lands
- Validators/derivations (Foundational) before any UI consumer

### Parallel Opportunities

- T001, T002, T003 in parallel (Foundational — independent modules)
- T007 in parallel with T006 once T005 lands (US1 — different Inspector sections)
- T018, T019, T021 in parallel (Polish)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Foundational — CRITICAL, blocks everything)
2. Complete Phase 2 (User Story 1)
3. **STOP and VALIDATE**: run the quickstart steps 1–3 and the US1 unit suite independently
4. Demo Kafka/producer/consumer configuration

### Incremental Delivery

1. Foundational → validators, binding-resource derivation, status-treatment derivation done
2. Add User Story 1 → test independently → configuration demo
3. Add User Story 2 → test independently → live health readout demo
4. Add User Story 3 → test independently → canvas-as-dashboard demo
5. Add User Story 4 → test independently → full feature complete
6. Polish sweep (lint/build/quickstart/full test run)

