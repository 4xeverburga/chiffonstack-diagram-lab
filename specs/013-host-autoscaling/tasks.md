# Tasks: Host Autoscaling / Replica Multiplier

**Input**: Design documents from `/specs/013-host-autoscaling/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/engine-ports.md, quickstart.md

**Tests**: Included — constitution VI mandates unit tests for every engine formula/policy and serialization change; the scaler's determinism (FR-008) makes event sequences exactly assertable. UI is manual smoke per quickstart.md, except the pure projection helper which is unit-tested.

**Organization**: Tasks grouped by user story. US1+US2 (the scaler loop) form the MVP; US4 (scaling-group visual) is the demo payoff. The constitution amendment is Phase 1 — the Constitution Check gate depends on it landing before the ports change.

## Phase 1: Setup

- [X] T001 Amend `.specify/memory/constitution.md` v3.0.0 → v3.1.0 (MINOR): Principle I closed parameter set gains `minReplicas`/`maxReplicas` on saturating host profiles; note scaler dynamics (watermarks, sustain, cooldown, boot delay) and the visible-replica cap remain internal tunables; prepend Sync Impact Report; update the "Hosts first, lean parameters" bullet in `PRODUCT.md` to mention replica bounds
- [X] T002 Add autoscaling tunables to `src/engine/config.ts`: `AUTOSCALE_HIGH_WATERMARK` (0.80), `AUTOSCALE_LOW_WATERMARK` (0.30), `AUTOSCALE_SUSTAIN_MS`, `AUTOSCALE_COOLDOWN_MS`, `AUTOSCALE_BOOT_DELAY_MS`, `SCALING_EVENT_HISTORY_LIMIT` (10), `VISIBLE_REPLICA_CAP` (4) — each with a comment stating the constraint it encodes

## Phase 2: Foundational (blocking all user stories)

- [X] T003 Extend `src/engine/ports.ts`: saturating `HostNodeSim` variants gain `minReplicas`/`maxReplicas`; add `ScalingEvent` and `HostReplicaTelemetry` types; `HostNodeMetrics` gains `replicas?: HostReplicaTelemetry` (data-model.md shapes; client_pool/external_api unchanged)
- [X] T004 Replica bounds serialization in `src/lab/exportDiagram.ts`: export bounds inside the host sim payload; on import, hosts missing bounds get `minReplicas: 1, maxReplicas: 1` written explicitly (research D5); extend `test/lab/exportDiagram.test.ts` with a pre-013 JSON fixture
- [X] T005 Replica runtime lifecycle in `src/engine/simulation.ts`: per-host `ReplicaRuntime` map (init `nominalCount = minReplicas`, empty booting/accumulators/events) created on `loadTopology`, re-clamped on topology update (research D7), cleared to initial state on `reset()` (FR-014); extend `test/engine/simulation.test.ts`

**Checkpoint**: build/lint/test green; bounds flow through config and serialization with no behavior change (runtime unused yet).

## Phase 3: User Story 1 — Watch a service scale out under rising load (P1)

**Goal**: sustained high saturation adds replicas one at a time up to maxReplicas, with boot-delay lag before capacity relief.
**Independent test**: ramp a 1–4 host to 3× single-replica capacity; replicas step 1→2→3 only after sustain, capacity relief arrives exactly one boot delay after each event, count never exceeds 4.

- [X] T006 [P] [US1] Create `src/engine/autoscaler.ts`: pure per-window decision `(ReplicaRuntime, perReplicaSaturation, simTimeMs, windowSizeMs) → (ReplicaRuntime', ScalingEvent | undefined)` — scale-up path per research D1/D2: sustain accumulator `timeAboveHighMs`, cooldown gate, boot-entry queue (`readyAt = now + AUTOSCALE_BOOT_DELAY_MS`), boot draining, event ring append trimmed to `SCALING_EVENT_HISTORY_LIMIT`
- [X] T007 [P] [US1] Create `test/engine/autoscaler.test.ts` (scale-up half): no action below sustain (transient spike), action fires exactly at sustain with cooldown respected, no action at maxReplicas, boot entry drains at exactly `readyAt`, determinism (same input sequence twice ⇒ identical events)
- [X] T008 [US1] Per-replica division in `src/engine/hostModel.ts`: compute on `perReplicaRPS = incomingRPS / effectiveReplicas`, scale `forwardedRPS`/`shedRPS` back by `effectiveReplicas` (per-replica `manualMaxRPS` clamp ⇒ total cap = effective × cap, research D3); report `saturationRatio`/`latencyMs` per replica; extend `test/engine/hostModel.test.ts` (division correctness, per-replica clamp composition)
- [X] T009 [US1] Integrate scaler into `src/engine/flowPropagation.ts`: drain boot queue at window start, run 011 math on effective replicas, feed per-replica saturation to the autoscaler, emit `replicas` telemetry block (nominal/booting/effective counts, per-replica saturation, events); extend `test/engine/flowPropagation.test.ts` with the full US1 ramp scenario (latency climbs during boot delay, drops after)
- [X] T010 [P] [US1] Add replica-division and threshold-scaling-policy formula descriptors with sources (Kubernetes HPA docs, Denning & Buzen 1978 — research D6) in `src/engine/formulaCatalog.ts`; extend `test/engine/formulaCatalog.test.ts` (≥1 source each, live inputs match)
- [X] T011 [US1] Add `minReplicas`/`maxReplicas` fields (integer, ≥1, min ≤ max validation) to `src/lab/hostConfigFields.tsx` for saturating profiles only, wired through `src/lab/useDiagramMutations.ts`; extend `test/lab/useDiagramMutations.test.ts`
- [X] T012 [US1] Give the starter API host bounds 1–4 in `src/lab/initialDiagram.ts` (explicit values on all hosts — no defaults) so the quickstart demo scales out of the box

**Checkpoint**: quickstart steps 1–4 pass (Inspector shows counts via raw telemetry even before US4's visuals).

## Phase 4: User Story 2 — Scale back in when load drops (P1)

**Goal**: sustained low saturation removes replicas stepwise to minReplicas; hysteresis band holds; cooldown spaces actions.
**Independent test**: after scaling to 3, drop load to 10% of scaled capacity; verify 3→2→1 with ≥ cooldown between events, stop at min, no action inside the band.

- [X] T013 [US2] Extend `src/engine/autoscaler.ts` with the scale-down path: `timeBelowLowMs` accumulator, immediate capacity effect, cancel newest booting entry before removing a serving replica, hysteresis band resets both accumulators, min bound respected
- [X] T014 [P] [US2] Extend `test/engine/autoscaler.test.ts` (scale-down half): stepwise descent with cooldown spacing, band hold (no flapping across three evaluations at steady load — SC-002), booting-entry cancellation on down-scale, min bound stop
- [X] T015 [US2] Extend `test/engine/flowPropagation.test.ts` with the full up-then-down cycle (US1 ramp + US2 drop) asserting the exact event sequence and queue-drain change: a queue feeding the scaled host drains at effective × per-replica remaining capacity (FR-011)

**Checkpoint**: MVP complete — the full scaling loop is observable in telemetry and deterministic in tests.

## Phase 5: User Story 3 — Fixed replica count (P2)

**Goal**: min = max disables scaler dynamics; min = max = 1 is bit-identical to 011.
**Independent test**: min=max=1 metrics stream equals pre-013 output across an overload sweep; min=max=3 divides load by 3 with zero scaling events.

- [X] T016 [P] [US3] Short-circuit in `src/engine/autoscaler.ts`/`src/engine/flowPropagation.ts`: when `minReplicas === maxReplicas` skip scaler evaluation entirely (no accumulators, no events); when both are 1, take the unmodified 011 single-instance code path
- [X] T017 [P] [US3] Regression tests in `test/engine/hostModel.test.ts` and `test/engine/flowPropagation.test.ts`: min=max=1 produces values identical to the pre-013 expectations (reuse existing 011 test vectors verbatim — SC-003); min=max=3 divides by 3 with an empty event list; pre-013 JSON import behaves as min=max=1 end-to-end

## Phase 6: User Story 4 — Scaling group on the canvas (P2)

**Goal**: scaled hosts render as a box-styled group; replica chips stack vertically, pop in/out on scaling events, cap at 4 with "+N" overflow; booting chips look pending.
**Independent test**: ramp a 1–6 host: group grows 1→4 visible chips then shows "+1"/"+2"; chips appear only when actions complete; clicking box or chip opens the host Inspector; exported JSON has zero replica sub-nodes.

- [X] T018 [P] [US4] Create `src/lab/scalingGroupProjection.ts`: pure `HostReplicaTelemetry → ScalingGroupProjection` (visible chips = min(nominal, VISIBLE_REPLICA_CAP) with booting flags, overflow count, vertical-stack layout metrics from design tokens, pulse direction on event change)
- [X] T019 [P] [US4] Create `test/lab/scalingGroupProjection.test.ts`: cap-4 + overflow remainders across 1→6→1, booting-chip flagging, count-change gating (identical telemetry ⇒ identical projection object), no projection for min=max=1 hosts
- [ ] T020 [US4] Create `src/lab/ScalingGroupNode.tsx`: box-styled group container (visually a box, not a node — border/fill from `src/lab/designTokens.ts`), replica chip child nodes (`parentId`, `extent: 'parent'`, non-draggable/non-connectable, clicks select the host), overflow badge, count badge, transient scaling pulse treatment (CSS, bounded)
- [ ] T021 [US4] Wire the projection into the canvas: register node types, derive group/chip nodes from store telemetry **only when a scaling event changes counts** (event-gated subscription, research D4 — never per window), keep edges/handles on the group node id; touch `src/App.tsx`, `src/sim/store.ts`, `src/lab/handleSides.ts`/`src/lab/useHandleVisibility.ts` as needed
- [ ] T022 [US4] Exclude group/chip node types from export in `src/lab/exportDiagram.ts` (whitelist) and assert zero replica sub-nodes in exported JSON in `test/lab/exportDiagram.test.ts` (SC-008)
- [X] T023 [US4] Replica telemetry + scaling event list ("↑ 3 at t=12.4s") in `src/lab/Inspector.tsx`; verify per-replica formulas render in `src/lab/FormulaPanel.tsx`

## Phase 7: Polish & cross-cutting

- [X] T024 [P] Performance sanity per SC-007: extend the windowed benchmark in `test/engine/flowPropagation.test.ts` to 30 nodes / 10k req/s with 1–4 bounds on every saturating host — per-window cost stays O(V+E)
- [~] T025 Automated gate confirmed green (`npm run lint`, `npm run build`, `npm run test` — 249 tests pass); manual quickstart walkthrough in a live browser NOT performed this session

## Implementation notes (2026-07-07)

- **MVP shipped in full**: T001–T019, T023, T024. The deterministic scaler
  loop (sustain/watermarks/cooldown/boot-delay/hysteresis), per-replica host
  math, queue accept-capacity scaling (FR-011), serialization + pre-013
  import migration, sourced formula descriptors, and the two Inspector
  inputs are all implemented and unit-tested (249 tests green, `tsc -b`
  clean, `oxlint` clean, `vite build` clean).
- **Scope decision on T020–T022 (scaling-group canvas visual)**: NOT
  implemented this session. Building real xyflow parent/child subflow node
  types wired into `App.tsx`'s existing renderedNodes/handle-visibility/
  status-treatment pipeline is a materially riskier change to make blind
  (no live-browser iteration loop in this session to catch subflow-specific
  xyflow quirks), so it was descoped in favor of shipping the fully-tested
  engine loop plus a lighter-weight telemetry surface instead:
  `src/lab/scalingGroupProjection.ts` (T018/T019, pure and fully unit-tested
  — ready for a `ScalingGroupNode.tsx` to consume whenever that follow-up
  lands) and replica count/booting/effective/per-replica-saturation/event
  history rendered in both `Inspector.tsx` and `NodeInfoButton.tsx` (T023,
  expanded scope) instead of on-canvas chip nodes. User Story 4's on-canvas
  "watch nodes pop in/out" payoff is therefore NOT yet delivered — only its
  telemetry/data layer is. T022 (export whitelist) has nothing to exclude
  yet since no new node types were introduced.
- If/when T020–T022 are picked up: `scalingGroupProjection.ts`'s
  `projectScalingGroup`/`isScalingGroupHost` are the ready-made inputs: feed
  a scaled host's `HostReplicaTelemetry` (from `NodeMetrics.host.replicas`)
  straight in.

## Dependencies

- Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) ∥ Phase 6 (US4) → Phase 7
- T001 (constitution amendment) MUST precede T003 (the ports change is what the amended gate licenses).
- US2 extends US1's `autoscaler.ts`; US3 and US4 are independent of each other after US2 (US4 needs the telemetry block from T009; US3 needs only T008/T009).
- T010 (sourced descriptors) must land before the feature PR merges (constitution II), but can be built in parallel with T008/T009.

## Parallel opportunities

- Phase 3: T006+T007 ∥ T010; T011 ∥ T012 after T003.
- Phase 5 ∥ Phase 6 entirely (engine tests vs lab visuals).
- Phase 6: T018+T019 ∥ T020 before the T021 wiring task.

## Implementation strategy

MVP = Phases 1–4: the deterministic scaling loop, observable in Inspector telemetry and fully unit-tested. US3 locks the regression guarantee; US4 delivers the visual payoff (group box, chips, overflow) as an independent increment; Phase 7 gates last. Ship order matters for review: constitution amendment first commit, engine loop next, visuals last.
