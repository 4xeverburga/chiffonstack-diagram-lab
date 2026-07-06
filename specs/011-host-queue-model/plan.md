# Implementation Plan: Generalized Host/Queue Simulation Model

**Branch**: `011-host-queue-model` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-host-queue-model/spec.md`

## Summary

Replace the role-based simulation model (`generator/processor/producer/consumer/sink` + deep Kafka node) with exactly two simulated node kinds — **Host** (deeply modeled compute: saturation ρ, smooth ρ/(1−ρ) hockey-stick latency, manual vs calculated capacity) and **Queue** (zero-config buffer: throughput in/out, backlog) — with traffic configuration on edges (`trafficShareRatio`, `averagePayloadSizeKB`, `targetComputeWeightMultiplier`, `pathIoLatencyMs`). The deep Kafka model is removed per constitution v3.0.0 Principle I. The delivery skeleton (ports, Web Worker, windowed metrics, HeatEdge sigmoid pipeline, FormulaDescriptor infrastructure) is reused unchanged in shape; only the domain model inside it is replaced.

Because traffic in this model is fully determined per window by rates and capacities (no stochastic per-request behavior survives the new host math), the engine's per-window computation becomes a **deterministic flow propagation pass in topological order** layered over the existing tick/window loop — analogous to how `computeKafkaWindowMetrics` already works, but for the whole graph. The Poisson event queue remains only as the client-pool arrival jitter source feeding the windowed rate.

## Technical Context

**Language/Version**: TypeScript ~5.8 (strict), React 19

**Primary Dependencies**: Vite SPA, `@xyflow/react` canvas, Zustand store, Web Worker host; no new runtime dependencies

**Storage**: N/A (topology serializes to plain JSON via React Flow `data`, per constitution)

**Testing**: Vitest unit tests for all engine formulas/propagation; manual canvas smoke check for UI (constitution VI)

**Target Platform**: Static web (CSR), deploy target `sugar.kekeros.com`

**Project Type**: Single Vite SPA — `src/engine` (pure core), `src/sim` (worker + store adapters), `src/lab` (canvas UI)

**Performance Goals**: SC-006 — fluid canvas with ≥30 simulated nodes at ≥10,000 req/s aggregate; per-window cost O(nodes + edges), never per-event React updates

**Constraints**: Closed parameter set (FR-020 / constitution I); every metric ships a sourced FormulaDescriptor (constitution II); engine imports nothing from React/DOM/xyflow/Zustand (constitution IV); all tunables in `src/engine/config.ts`; no default parameter values (CLAUDE.md); root-relative imports (CLAUDE.md)

**Scale/Scope**: ~15 engine/UI modules touched; removes `src/engine/kafka/*` (~505 lines) and 5 Kafka-specific `src/lab` modules + their tests; adds host/queue model modules + formula catalog

## Constitution Check

*GATE: evaluated against constitution v3.0.0 (amended 2026-07-06 for this feature).*

| Principle | Verdict | Notes |
|---|---|---|
| I. Host-First Model Depth, Closed Parameter Set | ✅ PASS | This feature implements the principle: host saturation/latency model, zero-config queues, Kafka model removed, parameter set exactly FR-020. No new user-facing parameters introduced anywhere in the design. |
| II. Every Formula Is Traceable | ✅ PASS | New host/edge/queue formulas ship as named, unit-tested functions with structured source metadata (queueing theory / Little's law citations); reuses existing `FormulaDescriptor` + `validateFormulaDescriptorsHaveSources` pattern. |
| III. Open Source & Web-First | ✅ PASS | No backend, no new modes. Old saved JSON with retired roles degrades to visual nodes (spec FR-018) — documented migration behavior satisfies the backward-compat clause. |
| IV. Simulation Core Behind Ports | ✅ PASS | `SimRole`/`SimTopology`/`MetricsWindow` port shapes evolve but ports remain the only boundary; engine stays pure TS. Worker protocol unchanged. |
| V. Render Discipline | ✅ PASS | Metrics stay windowed; HeatEdge sigmoid pipeline reused; congestion flag rides the existing per-window edge data. No per-event messages added. |
| VI. Contributor-Legible Codebase | ✅ PASS | New modules stay under ~250 lines (host math, queue math, propagation, formula catalog split by responsibility); no default parameters; formulas unit-tested. |

**Post-Phase-1 re-check**: PASS — design artifacts introduce no violations; Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/011-host-queue-model/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── engine-ports.md  # Revised port contract (SimRole/metrics shapes)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── engine/                      # Pure core (constitution IV)
│   ├── config.ts                # + host/queue/edge tunables; − KAFKA_* constants
│   ├── ports.ts                 # SimRole → HostNodeSim/QueueNodeSim; edge config; metrics shapes
│   ├── components.ts            # graph build + cycle detection (kept); + topological order
│   ├── hostModel.ts             # NEW: capacity, ρ, hockey-stick latency, maxRPS shedding
│   ├── queueModel.ts            # NEW: inflow/outflow/backlog integration
│   ├── flowPropagation.ts       # NEW: per-window deterministic pass over the DAG
│   ├── formulaCatalog.ts        # NEW: FormulaDescriptor builders + sources (host/edge/queue)
│   ├── simulation.ts            # DES loop; window flush calls flowPropagation
│   ├── eventQueue.ts, poisson.ts, metrics.ts, sigmoidMapping.ts,
│   ├── flowAnimationSmoothing.ts # kept unchanged
│   └── kafka/                   # REMOVED (model.ts, formulas.ts, catalog.ts)
├── sim/                         # worker + store adapters (shapes updated, protocol kept)
│   ├── workerProtocol.ts, simWorker.ts, useSimulation.ts, store.ts
└── lab/                         # canvas UI
    ├── Inspector.tsx            # host/queue/edge config sections (FR-020 fields only)
    ├── hostConfigFields.tsx     # NEW (replaces kafkaConfigFields.tsx)
    ├── edgeConfigFields.tsx     # NEW: edge traffic config UI
    ├── FormulaPanel.tsx         # kept; renders new descriptors
    ├── EdgeToolbar.tsx, HeatEdge.tsx  # + congestion (red) treatment
    ├── hostStatusTreatment.ts   # NEW (replaces kafkaStatusTreatment.ts)
    ├── initialDiagram.ts        # new starter topology (client → API → DB (+ queue))
    ├── exportDiagram.ts         # serialize new shapes; degrade retired roles on import
    └── kafka*/KafkaMetricsPanel # REMOVED (kafkaConfigFields, kafkaRoleValidation,
                                 #   kafkaBindingResource, kafkaStatusTreatment,
                                 #   KafkaMetricsPanel, dualUnitLabel if unused)

test/
├── engine/                      # hostModel, queueModel, flowPropagation, formulaCatalog
│   └── kafka/                   # REMOVED
└── lab/                         # host status treatment, config field logic; kafka tests removed
```

**Structure Decision**: Single-project layout retained. The engine boundary (`src/engine` pure, `src/sim` adapters, `src/lab` UI) is constitutionally mandated and unchanged; this feature swaps modules within it.

## Phase 0 → research.md

Decisions recorded in [research.md](./research.md): D1 windowed deterministic propagation vs per-event simulation; D2 latency formula shape and clamp; D3 calculated-mode capacity formula; D4 queue drain derivation; D5 topology-order propagation with existing cycle detection; D6 maxRPS shedding semantics; D7 retired-role degradation on import; D8 formula sources.

## Phase 1 → data-model.md, contracts/, quickstart.md

- [data-model.md](./data-model.md) — HostNodeSim/QueueNodeSim/EdgeSimConfig config shapes, HostNodeMetrics/QueueNodeMetrics/EdgeMetrics telemetry shapes, validation rules, closed-parameter enumeration.
- [contracts/engine-ports.md](./contracts/engine-ports.md) — revised port contract (TopologyPort/TrafficSourcePort/MetricsSinkPort unchanged in shape; payload types replaced).
- [quickstart.md](./quickstart.md) — build/run/test loop and the P1 acceptance walkthrough.

## Complexity Tracking

*No constitution violations — table intentionally empty.*
