# Implementation Plan: Overload Collapse Mode for Host Nodes

**Branch**: `012-overload-collapse` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-overload-collapse/spec.md`

## Summary

Saturating host profiles (`transactional_api`/`worker_consumer`/`database_server`, both config modes) gain one new field, `overloadBehavior: 'clamp' | 'collapse'`. `clamp` reproduces 011/013 exactly (forwarded throughput plateaus at the host's cap, excess shed). `collapse` — the new default for freshly-assigned hosts — reproduces the "retrograde throughput" region of real congestion collapse: below the knee (`manualMaxRPS` in manual mode; the ρ=1 capacity point in calculated mode) it's identical to clamp; past it, forwarded goodput bends back down toward zero via a smooth, stateless, monotonically-decreasing curve (`kneeRPS / (1 + κ(overloadRatio−1)²)`, κ a new internal-only tunable), always finite and ≥ 0, continuous at the knee. A new `collapsed` host status and canvas treatment report material degradation; a new sourced formula descriptor (receive-livelock/USL-retrograde citations) appears only for collapse-mode hosts. Downstream/upstream propagation needs **zero** new engine mechanics — it rides the existing per-window `edgeOutputRPS`/`computeQueueMetrics` path once `hostModel.ts` emits the correct (lower) `forwardedRPS`. The feature includes the constitution amendment (v3.3.0 → v3.4.0, MINOR) admitting `overloadBehavior` into Principle I's closed set.

**Branch note**: `012-overload-collapse` was cut before feature 013 (host autoscaling) existed; `dev` (which already contains 013, fully merged, constitution at v3.3.0) was merged into this branch before planning began (research.md's "Branch topology note"), so this plan targets the current post-013 shape of `HostNodeSim`/`hostModel.ts`/`flowPropagation.ts`.

## Technical Context

**Language/Version**: TypeScript ~5.8 (strict), React 19

**Primary Dependencies**: Vite SPA, `@xyflow/react` ^12.11, Zustand, Web Worker host; no new runtime dependencies

**Storage**: N/A — `overloadBehavior` serializes inside the host sim payload like every other host field; no new engine state, no new cross-window carried maps (research.md D4)

**Testing**: Vitest for the collapse curve (exact values at known operating points: below knee, at knee, 2×/3×/5×/100× past it, zero-capacity), status derivation, formula descriptors, and end-to-end propagation (queue backlog, downstream starvation); manual canvas smoke per quickstart

**Target Platform**: Static web (CSR), `sugar.kekeros.com`

**Project Type**: Single Vite SPA — `src/engine` (pure core), `src/sim` (adapters), `src/lab` (canvas UI)

**Performance Goals**: No change — the collapse curve is O(1) extra arithmetic per saturating host per window, no new passes, no new state

**Constraints**: Exactly one new user-facing parameter (FR-001), admitted via in-scope constitution amendment (FR-012); decay steepness and collapsed-status threshold are internal tunables in `src/engine/config.ts`; `clamp` mode byte-identical regression (SC-003, FR-002); statelessness (FR-010, SC-004); no new propagation rules (FR-009); no default parameter values; root-relative imports

**Scale/Scope**: ~5 engine modules touched (0 new), ~6 lab modules touched (0 new), constitution + PRODUCT.md + CLAUDE.md amendment, ~4 test files extended (0 new files expected — collapse cases extend existing `hostModel.test.ts`/`flowPropagation.test.ts`/`formulaCatalog.test.ts`)

## Constitution Check

*GATE: evaluated against constitution v3.3.0 (current, post-013); this feature ships the v3.4.0 amendment as its first implementation step.*

| Principle | Verdict | Notes |
|---|---|---|
| I. Host-First Model Depth, Closed Parameter Set | ✅ PASS (amendment in scope) | Adds exactly `overloadBehavior` — the amendment admitting it (MINOR, per the versioning clause) is FR-012 and MUST merge with the feature. The curve shape itself (κ, collapsed-status ratio) stays an internal tunable in `config.ts`, never surfaced. Queues remain zero-config; no queue-side propagation change (research.md D4). |
| II. Every Formula Is Traceable | ✅ PASS | New collapse/goodput descriptor ships ≥1 citation (receive-livelock / USL-retrograde literature) via the existing `formulaCatalog` pattern; `validateFormulaDescriptorsHaveSources` still gates emission. |
| III. Open Source & Web-First | ✅ PASS | Serialized shape change is additive; old JSON without `overloadBehavior` imports as `clamp` (FR-005, documented migration). |
| IV. Simulation Core Behind Ports | ✅ PASS | The curve, status, and formula descriptor all live inside the engine; `MetricsWindow`'s shape only grows by one status literal and one conditional descriptor. Canvas treatment is a pure `src/lab` projection over `HostNodeMetrics.status`, same as `saturated`/`overloaded` today. |
| V. Render Discipline | ✅ PASS | Collapse metrics ride the existing windowed path; no per-event messages; canvas treatment is a bounded CSS animation, same mechanism as the existing two status treatments. |
| VI. Contributor-Legible Codebase | ✅ PASS | The collapse curve is one small, exhaustively-unit-tested pure function (`collapseForwardedRPS` in `hostModel.ts`), reusing the existing per-mode knee/rho computation rather than adding a parallel code path; no file crosses the ~250-line guidance as a result of this change. |

**Post-Phase-1 re-check**: PASS — design introduces no further parameters or boundary leaks beyond the one admitted by the amendment; Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/012-overload-collapse/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── engine-ports.md  # Delta contract: overloadBehavior, collapsed status, collapse descriptor
└── tasks.md              # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
.specify/memory/constitution.md   # AMEND v3.3.0 → v3.4.0 (Principle I closed set += overloadBehavior)
PRODUCT.md                        # touch "Hosts first, lean parameters" bullet to mention overloadBehavior/collapse

src/
├── engine/
│   ├── config.ts                 # + HOST_COLLAPSE_DECAY_KAPPA, HOST_COLLAPSE_STATUS_RATIO,
│   │                              #   LEGACY_OVERLOAD_BEHAVIOR_FOR_IMPORT
│   ├── ports.ts                  # HostNodeSim manual/calculated saturating variants += overloadBehavior;
│   │                              #   HostNodeMetrics['status'] += 'collapsed'
│   ├── hostModel.ts               # + collapseForwardedRPS() shared helper; manual/calculated forwardedRPS
│   │                              #   branch on overloadBehavior; deriveStatus += collapsed check (first)
│   ├── flowPropagation.ts         # UNCHANGED apart from: conditionally append the new collapse formula
│   │                              #   descriptor when overloadBehavior === 'collapse'. hostAcceptCapacityRPS
│   │                              #   is explicitly NOT touched (research.md D4).
│   └── formulaCatalog.ts          # + buildHostCollapseDescriptor (sourced: receive-livelock / USL-retrograde)
├── sim/                           # no changes (protocol/state shape unaffected)
└── lab/
    ├── hostConfigFields.tsx       # + OverloadBehaviorField chip control (both config modes, compute
    │                              #   profiles only); handleModeChange carries the field over on mode switch
    ├── Inspector.tsx              # defaultSimForChoice: overloadBehavior: 'collapse' for new compute hosts
    ├── initialDiagram.ts          # starter hosts get overloadBehavior: 'collapse'
    ├── exportDiagram.ts           # serialize overloadBehavior; absence imports as LEGACY_OVERLOAD_BEHAVIOR_FOR_IMPORT
    ├── hostStatusTreatment.ts     # APPLIED_STATUSES += 'collapsed'
    └── App.css                    # + .sim-status-collapsed treatment (distinct from saturated/overloaded)

test/
├── engine/hostModel.test.ts        # extend: collapse curve (below/at/past knee, 2x/3x/5x/100x, zero-capacity,
│                                    #   calculated-mode collapse, clamp regression unchanged), collapsed status
├── engine/flowPropagation.test.ts  # extend: collapse formula descriptor gating, downstream starvation,
│                                    #   two-path queue-backlog-acceleration scenario (research.md D4 topology)
└── engine/formulaCatalog.test.ts   # extend: collapse descriptor sourced, isBinding past the knee
```

**Structure Decision**: Single-project layout, constitutionally fixed engine/adapter/UI split — unchanged from 011/013. No new modules: the collapse curve is small enough to live as one additional function in `hostModel.ts` (the file already owns the per-mode knee/rho computation this reuses) rather than a new file, consistent with the "single-purpose module" guidance without over-splitting a ~15-line pure helper.

## Phase 0 → research.md

Decisions in [research.md](./research.md): D1 the knee is `manualMaxRPS`/the ρ=1 point, not `manualSaturationRPS`; D2 the retrograde curve shape and its internal tunable, with citations; D3 calculated mode gets the same curve at its own knee; D4 queue backpressure (`hostAcceptCapacityRPS`) stays completely unchanged — no new propagation rule, with a documented single-queue-topology limitation; D5 `collapsed` status derivation; D6 Inspector visibility/defaults/migration; D7 formula descriptor gating.

## Phase 1 → data-model.md, contracts/, quickstart.md

- [data-model.md](./data-model.md) — `overloadBehavior` on `HostNodeSim`, the shared `collapseForwardedRPS` computation, `collapsed` status derivation, canvas/Inspector/serialization deltas.
- [contracts/engine-ports.md](./contracts/engine-ports.md) — delta contract on 013's port payloads plus behavioral guarantees (regression, knee continuity, statelessness, no-new-propagation-rule).
- [quickstart.md](./quickstart.md) — dev loop and the four user stories' walkthroughs.

## Complexity Tracking

*No constitution violations — table intentionally empty. (The Principle I parameter addition is not a violation: the constitution's amendment path is being exercised as designed, with the MINOR bump in scope, exactly as feature 013 already did three times.)*
