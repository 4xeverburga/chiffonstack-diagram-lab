# Implementation Plan: Host Autoscaling / Replica Multiplier

**Branch**: `013-host-autoscaling` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-host-autoscaling/spec.md`

## Summary

Saturating host profiles gain horizontal scaling bounded by two new parameters (`minReplicas`, `maxReplicas`). The engine divides incoming load across replicas and reuses the 011 host math per replica; a deterministic, windowed auto-scaler steps the count by one when *sustained* saturation crosses internal high/low watermarks, with a boot delay before new capacity serves. On the canvas, a scaled host renders as a **scaling group** — a box-styled React Flow parent container encasing one replica node per running replica (max 4 visible + overflow badge), a pure visual projection of telemetry that is never simulated or serialized. The feature includes the constitution amendment (v3.0.0 → v3.1.0, MINOR) admitting the two parameters into Principle I's closed set.

## Technical Context

**Language/Version**: TypeScript ~5.8 (strict), React 19

**Primary Dependencies**: Vite SPA, `@xyflow/react` ^12.11 (subflow/parent-node support confirmed), Zustand, Web Worker host; no new runtime dependencies

**Storage**: N/A — `minReplicas`/`maxReplicas` serialize inside the host sim payload; replica sub-nodes are render-only and whitelisted out of exported JSON

**Testing**: Vitest for scaler policy, replica math, and telemetry (deterministic windowed evaluation makes event sequences exactly assertable); manual canvas smoke per quickstart

**Target Platform**: Static web (CSR), `sugar.kekeros.com`

**Project Type**: Single Vite SPA — `src/engine` (pure core), `src/sim` (adapters), `src/lab` (canvas UI)

**Performance Goals**: SC-007 — 011's bar (≥30 nodes, ≥10k req/s) with scaling active on every host; scaler adds O(hosts) work per window; group visuals re-render only on scaling events (rare), not per window

**Constraints**: Exactly two new user-facing parameters (FR-001) admitted via in-scope constitution amendment (FR-015); watermarks/sustain/cooldown/boot-delay/visible-cap are internal tunables in `src/engine/config.ts`; determinism (FR-008); replicas are one simulated host (FR-010b); no default parameter values; root-relative imports

**Scale/Scope**: ~6 engine modules touched (1 new), ~7 lab modules touched (2 new), constitution + PRODUCT.md amendment, ~4 new/extended test files

## Constitution Check

*GATE: evaluated against constitution v3.0.0; this feature ships the v3.1.0 amendment as its first implementation step.*

| Principle | Verdict | Notes |
|---|---|---|
| I. Host-First Model Depth, Closed Parameter Set | ✅ PASS (amendment in scope) | Adds exactly `minReplicas`/`maxReplicas` — the amendment admitting them (MINOR, per the versioning clause "each new parameter admitted past the closed-parameter gate") is FR-015 and MUST merge with the feature. All scaler dynamics (watermarks, sustain, cooldown, boot delay) and the visible-replica cap stay internal tunables. Queues remain zero-config. |
| II. Every Formula Is Traceable | ✅ PASS | Per-replica load division and the threshold scaling policy ship sourced descriptors (HPA policy docs + operational-analysis reference) via the existing `formulaCatalog` pattern. |
| III. Open Source & Web-First | ✅ PASS | Serialized shape change is additive; old JSON without replica bounds imports as min=max=1 (documented migration, FR-013). |
| IV. Simulation Core Behind Ports | ✅ PASS | Replica state lives inside the engine; telemetry extends `HostNodeMetrics` through the existing `MetricsWindow`. The scaling-group visual is entirely a `src/lab` projection — the engine knows nothing about it. |
| V. Render Discipline | ✅ PASS | Replica telemetry rides the existing windowed path. Group child nodes are added/removed only when a scaling event fires (bounded by cooldown — inherently rare), never per window; scaling-pulse animation is CSS-bounded. |
| VI. Contributor-Legible Codebase | ✅ PASS | Scaler policy isolated in a new pure module (`autoscaler.ts`) with exhaustive unit tests; group visual isolated in `ScalingGroupNode.tsx` + a pure projection helper; all files under ~250 lines. |

**Post-Phase-1 re-check**: PASS — design introduces no further parameters or boundary leaks; Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/013-host-autoscaling/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── engine-ports.md  # Delta contract: replica config/telemetry shapes
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
.specify/memory/constitution.md   # AMEND v3.0.0 → v3.1.0 (Principle I closed set += minReplicas/maxReplicas)
PRODUCT.md                        # touch "Hosts first, lean parameters" bullet to mention replica bounds

src/
├── engine/
│   ├── config.ts                # + AUTOSCALE_HIGH_WATERMARK (0.80), AUTOSCALE_LOW_WATERMARK (0.30),
│   │                            #   AUTOSCALE_SUSTAIN_MS, AUTOSCALE_COOLDOWN_MS, AUTOSCALE_BOOT_DELAY_MS,
│   │                            #   SCALING_EVENT_HISTORY_LIMIT
│   ├── ports.ts                 # HostNodeSim saturating variants += minReplicas/maxReplicas;
│   │                            #   HostNodeMetrics += replicas telemetry block
│   ├── autoscaler.ts            # NEW: pure scaler policy — sustain tracking, watermark decision,
│   │                            #   cooldown, boot queue integration (deterministic per window)
│   ├── hostModel.ts             # per-replica division: effectiveReplicas into rho/capacity/shedding
│   ├── flowPropagation.ts       # plumb replica runtime state per host; call autoscaler each window
│   ├── formulaCatalog.ts        # + replica-division and scaling-policy descriptors (sourced)
│   └── simulation.ts            # replica runtime map lifecycle (init to minReplicas, reset clears)
├── sim/                         # payload types only (protocol unchanged)
│   └── store.ts, workerProtocol.ts, useSimulation.ts
└── lab/
    ├── ScalingGroupNode.tsx     # NEW: box-styled group node type + replica child node type,
    │                            #   overflow badge, scaling pulse treatment
    ├── scalingGroupProjection.ts# NEW: pure telemetry → child-node/layout projection
    │                            #   (visible cap, vertical stacking, booting treatment)
    ├── hostConfigFields.tsx     # + minReplicas/maxReplicas fields (min ≤ max validation)
    ├── Inspector.tsx            # + replica telemetry + scaling event list
    ├── exportDiagram.ts         # serialize replica bounds; whitelist group/replica sub-nodes OUT;
    │                            #   absent bounds import as min=max=1
    ├── useDiagramMutations.ts   # host config mutation for the two new fields
    └── initialDiagram.ts        # starter API host gets 1–4 bounds so the demo scales out of the box

test/
├── engine/autoscaler.test.ts    # NEW: policy truth table, sustain/cooldown/boot determinism
├── engine/hostModel.test.ts     # extend: per-replica division, min=max=1 regression
├── engine/flowPropagation.test.ts # extend: end-to-end scale-out/in sequences, queue drain × replicas
├── engine/formulaCatalog.test.ts  # extend: new descriptors sourced
└── lab/scalingGroupProjection.test.ts # NEW: cap-4 + overflow, booting treatment, serialization exclusion
```

**Structure Decision**: Single-project layout, constitutionally fixed engine/adapter/UI split. Scaler policy gets its own pure module rather than growing `hostModel.ts` (single-responsibility + file-size rule); the group visual's logic lives in a pure projection helper so the cap/overflow/stacking rules are unit-testable without React.

## Phase 0 → research.md

Decisions in [research.md](./research.md): D1 sustain/cooldown state machine (deterministic, window-driven); D2 boot queue semantics (effective vs nominal replicas); D3 per-replica math via effective-replica division (single aggregate host, not N simulated hosts); D4 scaling-group visual via xyflow parent/child nodes as a store-level projection; D5 serialization/whitelisting of render-only nodes; D6 formula sources (HPA docs, operational analysis); D7 mid-run config edit re-clamp; D8 event history bounding.

## Phase 1 → data-model.md, contracts/, quickstart.md

- [data-model.md](./data-model.md) — replica bounds on `HostNodeSim`, `ReplicaRuntime` engine state, `HostReplicaTelemetry` on metrics, scaling-event record, projection rules for the group visual.
- [contracts/engine-ports.md](./contracts/engine-ports.md) — delta contract on 011's port payloads plus behavioral guarantees (determinism, boot-delay capacity lag, event-history bound).
- [quickstart.md](./quickstart.md) — dev loop and the scale-out/scale-in acceptance walkthrough.

## Complexity Tracking

*No constitution violations — table intentionally empty. (The Principle I parameter addition is not a violation: the constitution's amendment path is being exercised as designed, with the MINOR bump in scope.)*
