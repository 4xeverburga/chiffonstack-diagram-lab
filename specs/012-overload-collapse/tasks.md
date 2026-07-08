# Tasks: Overload Collapse Mode for Host Nodes

**Input**: Design documents from `/specs/012-overload-collapse/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/engine-ports.md, quickstart.md

**Tests**: Included — constitution VI mandates unit tests for every engine formula/status derivation/formula-descriptor change, and the curve's statelessness (FR-010) makes exact operating points assertable. UI is manual/Playwright smoke per quickstart.md (no component-test harness exists for `hostConfigFields.tsx`, matching plan.md's Testing note), except the pure canvas-treatment helper (`hostStatusTreatment.ts`), which is unit-tested like its `saturated`/`overloaded` precedent.

**Organization**: Tasks grouped by user story. US1+US2 (the collapse curve + its Inspector control) form the MVP. US3 is deliberately near-zero-code (research.md D4: propagation rides existing, unmodified mechanics) — its tasks are almost entirely regression/verification tests. US4 (formula traceability) is independent of US3 and can ship in either order after US1/US2.

**Note on the constitution amendment**: v3.3.0 → v3.4.0 (Principle I closed set += `overloadBehavior`) already landed during planning (see the `plan(012)` commit) — no task below amends the constitution again.

## Phase 1: Setup

- [X] T001 Add collapse tunables to `src/engine/config.ts`: `HOST_COLLAPSE_DECAY_KAPPA` (2, research.md D2 — satisfies SC-001's "<20% of peak by 3x"), `HOST_COLLAPSE_STATUS_RATIO` (0.5, research.md D5 — the "materially degraded" goodput threshold for `collapsed` status), `LEGACY_OVERLOAD_BEHAVIOR_FOR_IMPORT` (`'clamp'`, research.md D6 — the pre-012 JSON migration fallback) — each with a comment stating the constraint it encodes, mirroring the existing `AUTOSCALE_*`/`LEGACY_*` constants in the same file

## Phase 2: Foundational (blocking all user stories)

- [X] T002 Extend `src/engine/ports.ts`: saturating `HostNodeSim` variants (manual **and** calculated `transactional_api`/`worker_consumer`/`database_server`) gain `overloadBehavior: 'clamp' | 'collapse'` (the only new field — FR-001; `client_pool`/`external_api` variants unchanged — FR-006); `HostNodeMetrics['status']` gains `'collapsed'` (data-model.md, contracts/engine-ports.md payload table)
- [X] T003 [P] Bulk-add explicit `overloadBehavior` to every existing saturating-profile `HostNodeSim` literal this type change breaks: grep `configMode: 'manual'|configMode: 'calculated'` across **both** `src/` (`src/lab/initialDiagram.ts`, `src/lab/Inspector.tsx`'s `defaultSimForChoice`, `src/lab/hostConfigFields.tsx`'s `handleModeChange` branches) and `test/` (`test/engine/hostModel.test.ts`, `test/engine/flowPropagation.test.ts`, `test/engine/formulaCatalog.test.ts`, `test/engine/simulation.test.ts`, plus any other hit the grep surfaces) — per repo memory, `test/**` is not `tsc`-checked, so a missed literal fails silently at runtime (`undefined` in arithmetic), not at compile time; only `npx vitest run` actually exercises it
- [X] T004 [P] Serialization in `src/lab/exportDiagram.ts`'s `plainNodeSim`: read/validate `overloadBehavior` (one of the two literals), fill `LEGACY_OVERLOAD_BEHAVIOR_FOR_IMPORT` whenever the field is absent (both fully pre-012 diagrams and diagrams already carrying 013's replica/watermark fields but missing this one — FR-005/SC-005), same "absence-triggers-legacy-fill" pattern already used for `bootDelayMs`/watermarks; extend `test/lab/exportDiagram.test.ts` with a pre-012 JSON fixture (missing `overloadBehavior` entirely) asserting it imports as `clamp`

**Checkpoint**: `npm run build` / `npm run lint` / `npx vitest run` all green; type surface + serialization updated with zero behavior change yet (collapse math not wired into `hostModel.ts`).

## Phase 3: User Story 1 — Watch a host collapse under overload (P1)

**Goal**: past the knee, a collapse-mode host's forwarded goodput bends back down smoothly toward zero instead of plateauing; a new `collapsed` status reports material degradation; recovery is immediate and stateless.
**Independent test**: sweep offered load 0.5×→3× (and back down) on a collapse-mode host with capacity 500 req/s; verify goodput rises, peaks near capacity, decays smoothly toward ~zero past the knee, and recovers symmetrically on the way back down.

- [X] T005 [US1] Add shared `collapseForwardedRPS(incomingRPS, kneeRPS)` helper to `src/engine/hostModel.ts` (research.md D2): zero-capacity guard (`kneeRPS <= HOST_ZERO_CAPACITY_EPSILON` ⇒ `0`, avoiding divide-by-zero), pass-through at/below the knee (`incomingRPS <= kneeRPS` ⇒ `incomingRPS`), else `kneeRPS / (1 + HOST_COLLAPSE_DECAY_KAPPA * (overloadRatio - 1) ** 2)` where `overloadRatio = incomingRPS / kneeRPS`
- [X] T006 [US1] Wire `overloadBehavior` into `computeManualMetrics`: knee = `manualMaxRPS` (research.md D1 — the point 011's clamp shedding already keys off, not `manualSaturationRPS`); `clamp` keeps the unchanged `min(incoming, maxRPS)`/shed math (SC-003 regression); `collapse` routes `forwardedRPS` through `collapseForwardedRPS`, `shedRPS = max(0, incoming - forwardedRPS)` (FR-008)
- [X] T007 [US1] Wire `overloadBehavior` into `computeCalculatedMetrics`: knee = the already-computed (currently `void`-discarded) local `capacityRPS` (`threads/cpuTimeSec`, algebraically the ρ=1 point — research.md D1/D3); `clamp` stays unconditionally `forwardedRPS = incoming`, `shedRPS = 0` (011/013 "calculated mode never sheds" regression — SC-003); `collapse` newly sheds past ρ=1 via `collapseForwardedRPS` (a genuinely new capability for this mode)
- [X] T008 [US1] Extend `deriveStatus` in `src/engine/hostModel.ts`: check `'collapsed'` **first** (research.md D5), before the existing `overloaded`/`saturated`/`healthy` ladder — `overloadBehavior === 'collapse' && incomingRPS > kneeRPS && forwardedRPS < kneeRPS * HOST_COLLAPSE_STATUS_RATIO`; thread `overloadBehavior`/`kneeRPS`/`forwardedRPS` through from its two call sites (T006/T007)
- [X] T009 [P] [US1] Extend `test/engine/hostModel.test.ts`: collapse curve values at below-knee / exactly-at-knee / 2×/3×/5×/100× offered load in manual mode (SC-001's numeric bar: ~11% of peak at 3×), zero-capacity guard (no NaN/Infinity), calculated-mode collapse (new shedding past ρ=1, previously impossible), clamp-mode regression unchanged in **both** config modes (SC-003), knee-continuity exact equality between clamp and collapse at/below the knee (SC-002), `collapsed` status derivation (checked before `overloaded`, correct on both sides of the 0.5 ratio), latency untouched/never improves as goodput collapses (FR-013), stateless symmetric recovery sweeping the same load up then down (SC-004)

**Checkpoint**: quickstart.md steps 1–5 pass at the engine level — curve, status, and statelessness are all correct in isolation, independent of any UI.

## Phase 4: User Story 2 — Choose clamp vs collapse per host (P1)

**Goal**: the Inspector exposes exactly one new control, shown only where overload is meaningful; new hosts default to `collapse`; imported legacy diagrams default to `clamp`.
**Independent test**: two identical hosts, one per mode, same offered-load sweep — `clamp` plateaus flat at its cap past the knee, `collapse` bends back down; below the knee both report identical numbers.

- [X] T010 [P] [US2] Add an `OverloadBehaviorField` chip control (`clamp`/`collapse`) to `src/lab/hostConfigFields.tsx`'s `HostConfigFields`, rendered once in the branch already shared by both config modes — `client_pool`/`external_api` return earlier in the same function, so FR-006 ("no control for those profiles") holds with zero extra conditionals; `handleModeChange` carries `overloadBehavior` over unchanged on a mode switch, same pattern already used for the replica/watermark fields
- [X] T011 [P] [US2] Default `overloadBehavior: 'collapse'` on newly-assigned compute-profile hosts in `src/lab/Inspector.tsx`'s `defaultSimForChoice` (FR-005)
- [X] T012 [P] [US2] Give `src/lab/initialDiagram.ts`'s starter hosts (api-gateway, worker, database) explicit `overloadBehavior: 'collapse'` (fresh, code-authored content — not an imported legacy diagram, research.md D6; no default parameter values per CLAUDE.md)
- [X] T013 [US2] Live/manual verification (Playwright against `npm run dev`, per quickstart.md steps 6–8 — no component-test harness exists for `hostConfigFields.tsx`, matching plan.md's Testing note): confirm the Inspector shows exactly the one new chip control for `transactional_api`/`worker_consumer`/`database_server` in both config modes, shows no such control for `client_pool`/`external_api`, a freshly-assigned host defaults to `collapse`, and importing a diagram exported before this feature shows every host as `clamp`

**Checkpoint**: MVP complete (US1+US2) — collapse is a real, user-controllable, correctly-defaulted, correctly-migrated feature end to end.

## Phase 5: User Story 3 — Downstream starvation and upstream backlog (P2)

**Goal**: a collapsed host's low goodput propagates through the existing, **unmodified** edge/queue mechanics (research.md D4 — zero new propagation code).
**Independent test**: chain `A (client_pool) → B (collapse host) → C`, plus a queue `Q → B` (two inbound paths — a single-queue-only chain can't itself push `B` past its knee, since queue backpressure caps desired outflow at the knee regardless of mode); push `A` well past `B`'s knee and confirm `C`'s incoming RPS tracks `B`'s collapsed goodput while `Q`'s backlog growth accelerates.

- [X] T014 [US3] Extend `test/engine/flowPropagation.test.ts` with the two-path topology from research.md D4/quickstart.md step 9: assert `C`'s incoming RPS tracks `B`'s collapsed `forwardedRPS` as `A`'s offered load rises well past `B`'s knee (US3 AS1), and `Q`'s backlog growth rate rises as `B`'s acceptable rate through the direct edge falls (US3 AS2); additionally assert `hostAcceptCapacityRPS` is byte-identical between `clamp` and `collapse` modes in both config modes (research.md D4's "deliberately zero-line-diff" guarantee, FR-009)

**Checkpoint**: US3's acceptance scenarios pass without any new propagation code, confirming the D4 design bet.

## Phase 6: User Story 4 — Collapse formula is traceable (P2)

**Goal**: selecting a collapse-mode host shows the collapse/goodput formula with live inputs and a literature citation; clamp-mode hosts show no such descriptor.
**Independent test**: select a collapse-mode host mid-run, open the formula panel — the collapse formula appears with live inputs (`incomingRPS`/`kneeRPS`/`overloadRatio`) and ≥1 citation; a clamp-mode host's descriptor set is unchanged from pre-012.

- [X] T015 [US4] Add `buildHostCollapseDescriptor` to `src/engine/formulaCatalog.ts` (research.md D2/D7): sourced with Mogul & Ramakrishnan's receive-livelock paper (USENIX 1996/ACM TOCS 1997) and Gunther's Universal Scalability Law retrograde-throughput region (constitution II, FR-011); `isBinding: true` once `incomingRPS > kneeRPS`, mirroring the existing `buildHostShedDescriptor`/`buildHostSaturationDescriptor` convention
- [X] T016 [US4] Gate the descriptor in `src/engine/flowPropagation.ts`: append `buildHostCollapseDescriptor(...)` to a host's `descriptors` array only when `sim.overloadBehavior === 'collapse'` (clamp-mode hosts keep exactly their current descriptor set — SC-003's regression guarantee extends to the formula panel, research.md D7)
- [X] T017 [P] [US4] Extend `test/engine/formulaCatalog.test.ts`: collapse descriptor carries ≥1 source, `isBinding` past the knee and not below it, live input values match the current window's `incomingRPS`/`kneeRPS`/`overloadRatio`
- [X] T018 [P] [US4] Extend `test/engine/flowPropagation.test.ts`: collapse descriptor is present in a collapse-mode host's `formulaDescriptors` whenever selected (any load, not just past the knee), and entirely absent for clamp-mode hosts (regression — no new entries in the clamp descriptor set)

## Phase 7: Polish & cross-cutting

- [X] T019 [P] Canvas treatment: add `'collapsed'` to `APPLIED_STATUSES` in `src/lab/hostStatusTreatment.ts` (same idempotent-className derivation already used for `saturated`/`overloaded` — FR-007); add a third `.sim-status-collapsed` treatment to `src/App.css` (its own border/glow + keyframe cadence, visually distinct from `saturated`/`overloaded`, same bounded-CSS-animation mechanism — constitution V); extend `test/lab/hostStatusTreatment.test.ts` with collapsed-token add/swap/idempotent/remove cases mirroring the existing saturated/overloaded suite
- [X] T020 Full gate: `npm run lint`, `npm run build`, `npx vitest run` all green; LIVE browser walkthrough via Playwright against `npm run dev` covering quickstart.md's four user-story walkthroughs end to end (visible retrograde goodput + `collapsed` canvas treatment during a sweep, clamp-vs-collapse two-host side-by-side comparison — SC-007's "under 3 minutes" bar, the US3 two-path propagation topology, US4's formula panel with citations) — mirrors 013's final-gate verification depth

## Dependencies

- Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) ∥ Phase 6 (US4) → Phase 7.
- T002 (ports.ts type change) MUST precede T003/T004 (both fix/extend code against the new field) and every later phase.
- T005 (helper) → T006/T007 (call sites) → T008 (status, needs both call sites' `kneeRPS`/`forwardedRPS`) — all four edit `src/engine/hostModel.ts` sequentially.
- US2 (T010–T013) only needs Phase 2's type change, not US1's curve — Inspector UI can be built in parallel with US1's engine work if desired, though this list sequences US1 first since it's the feature's core.
- US4 (T015–T018) needs T006–T008 conceptually (the descriptor's live inputs are `kneeRPS`/`overloadRatio`) but not literally code-dependent on US3; US3 and US4 are independent of each other and can proceed in either order once US1 lands.
- T020 (final gate) depends on every prior task.

## Parallel opportunities

- Phase 2: T003 ∥ T004 (disjoint files: bulk literal fixes vs. `exportDiagram.ts`).
- Phase 4: T010 ∥ T011 ∥ T012 (three disjoint files, no cross-dependency beyond Phase 2).
- Phase 6: T017 ∥ T018 (disjoint test files).
- T009, T017, T018, T019 can each proceed in parallel with sibling non-test tasks in other phases once their own phase's implementation tasks land, since they touch test-only files no implementation task shares.

## Implementation strategy

MVP = Phases 1–4: the collapse curve is correct and unit-tested (US1), and a user can actually select it, get sensible defaults, and see legacy diagrams unaffected (US2). Phase 5 (US3) is almost pure verification that existing 011/013 propagation "just works" once `computeHostMetrics` returns the right number — its near-zero-code nature is itself evidence the D4 design decision was right. Phase 6 (US4) delivers the constitution-II-mandated traceability. Phase 7 gates last. Ship order: engine curve + status (US1) → Inspector control (US2) → propagation regression (US3) → formula descriptor (US4) → canvas treatment + final gate.
