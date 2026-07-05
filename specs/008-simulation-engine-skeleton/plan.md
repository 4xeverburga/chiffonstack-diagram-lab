# Implementation Plan: Simulation Engine Walking Skeleton

**Branch**: `008-simulation-engine-skeleton` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-simulation-engine-skeleton/spec.md`

## Summary

Foundation slice of the SUGAR pivot: remove the legacy Diagram Lab export
pipeline, move canvas state into a Zustand store with simulation payloads in
node/edge `data`, and build a pure-TypeScript discrete-event simulation core
that runs in a Web Worker behind three ports (topology in, traffic in,
metrics out). Deliver one end-to-end flow — Poisson load generator →
placeholder processor (fixed service rate, FIFO queue) → sink — with
start/pause/reset controls, per-node throughput/queue metrics in the
Inspector, and HeatEdge flow animation driven by a bounded sigmoid mapping of
per-edge throughput onto CSS variables.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict), React 19

**Primary Dependencies**: Vite 8, `@xyflow/react` 12, Zustand (new — mandated
by constitution Additional Constraints), Vitest 4, oxlint

**Storage**: none — topology JSON via clipboard/file, as today

**Testing**: Vitest for the engine core, ports, serialization, and sigmoid
mapping (pure functions, no DOM); manual canvas smoke check per quickstart.md

**Target Platform**: evergreen browsers (static CSR SPA); Web Worker via
Vite's native `new Worker(new URL(...), { type: 'module' })`

**Project Type**: single Vite SPA; engine core as a dependency-free source
subtree (`src/engine/`), not a separate package yet

**Performance Goals**: canvas interaction stays fluid (no ≥50 ms hitches)
with ≥10,000 simulated req/s (SC-002); steady-state throughput within 5% of
analytic expectation (SC-003)

**Constraints**: engine core imports nothing from React/DOM/xyflow/Zustand
(Principle IV); UI receives only fixed-interval aggregated metric windows,
200 ms cadence (Principle V); all animation variables bounded via logistic
mapping; no default parameter values (CLAUDE.md)

**Scale/Scope**: topologies of ~1–50 nodes; one simulation run at a time;
3 simulation roles (generator, placeholder processor, sink)

## Constitution Check

*GATE: evaluated against constitution v2.0.0 — pre-Phase-0 and re-checked post-Phase-1.*

| Principle | Verdict | Notes |
|---|---|---|
| I. Kafka-First Model Depth | PASS | No tech formulas added. Generator/sink/processor are the exempt generic building blocks; the processor is a visibly-labeled placeholder (FR-002), exactly the placeholder form Principle I prescribes. |
| II. Every Formula Is Traceable | PASS (deferred surface) | No sourced formulas exist yet. The engine's formula-metadata shape is **not** designed in this feature; spec 009 introduces it with the first real formulas. Placeholder label in the Inspector says "fixed-rate placeholder — no real model". |
| III. Open Source & Web-First | PASS | Remains a static CSR SPA. Legacy export removal keeps JSON import backward-compatible (FR-009, legacy fixture test). No local-mode affordances. |
| IV. Simulation Core Behind Ports | PASS | `src/engine/` is pure TS; ports defined in `src/engine/ports.ts`; worker host and canvas UI are adapters. Enforced by an oxlint no-restricted-imports rule scoped to `src/engine/` plus a unit test that imports the engine under Node (no DOM). |
| V. Render Discipline | PASS | Worker → UI messages are 200 ms MetricsWindow batches only. HeatEdge speed/density via logistic mapping to CSS variables; bounds fixed in `sigmoidMapping.ts`. No particles, no per-event state. |
| VI. Contributor-Legible Codebase | PASS | New modules all single-purpose, <250 lines. Engine logic fully unit-tested. No default parameters. |

Post-Phase-1 re-check: PASS — contracts in `contracts/` match the port rule;
no violations to justify (Complexity Tracking empty).

## Project Structure

### Documentation (this feature)

```text
specs/008-simulation-engine-skeleton/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── engine-ports.md  # Port interfaces + worker message protocol
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── engine/                    # PURE TS — no React/DOM/xyflow/Zustand imports
│   ├── ports.ts               # TopologyPort, TrafficSourcePort, MetricsSinkPort types
│   ├── eventQueue.ts          # binary-heap future-event list
│   ├── simulation.ts          # DES loop: schedule/advance/drain, run lifecycle
│   ├── components.ts          # generator / placeholderProcessor / sink behaviors
│   ├── poisson.ts             # exponential inter-arrival sampling (seedable PRNG)
│   ├── metrics.ts             # per-window aggregation (throughput, queue depth)
│   └── sigmoidMapping.ts      # bounded logistic: throughput → animation params
├── sim/                       # adapters (may import React/Zustand/engine)
│   ├── simWorker.ts           # Web Worker entry: hosts engine, emits windows
│   ├── workerProtocol.ts      # typed messages UI ↔ worker (shared, pure TS)
│   ├── useSimulation.ts       # hook: worker lifecycle, run state, window intake
│   └── store.ts               # Zustand store: nodes, edges, run status, metrics
├── lab/                       # existing canvas modules (kept, adapted)
│   ├── SimulationControls.tsx # start/pause/reset bar (replaces ExportBar slot)
│   ├── Inspector.tsx          # + simulation config (editable) & live metrics
│   ├── HeatEdge.tsx           # + CSS-var-driven speed/density from metrics
│   ├── nodeKinds.ts           # + simulation role kinds
│   ├── exportDiagram.ts       # topology JSON serialize/parse (kept; sim config whitelisted)
│   └── … (Sidebar, LabelNode, layout helpers unchanged)
└── App.tsx                    # thinned: wires store + worker hook + canvas

REMOVED: src/lab/{ExportBar.tsx, exportSvg.ts, exportComponentCode.ts,
exportBundle.ts, exportGeometry.ts, promptTemplate.ts, useExportActions.ts}
(fflate dependency dropped)

test/
├── engine/                    # unit tests: queue, poisson, components, metrics, sigmoid
├── sim/                       # protocol + store reducer tests
└── fixtures/legacy-diagram.json  # pre-pivot JSON for backward-compat test (FR-009)
```

**Structure Decision**: single SPA with a dependency-free `src/engine/`
subtree as the hexagonal core and `src/sim/` as its adapter layer. The
engine stays in-repo (not a workspace package) until a second consumer
exists — extracting it later is mechanical because of the import rule.

## Complexity Tracking

No constitution violations — table intentionally empty.
