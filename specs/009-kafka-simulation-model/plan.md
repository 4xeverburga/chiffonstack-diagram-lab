# Implementation Plan: Kafka Simulation Model (Engine-Side)

**Branch**: `009-kafka-simulation-model` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-kafka-simulation-model/spec.md`

## Summary

Implement the first deep technology model in SUGAR (Kafka) inside the pure TypeScript engine boundary, with source-traceable formulas and deterministic behavior. Extend `SimRole` with Kafka/producer/consumer roles, add a sourced hardware profile catalog, model the three physical walls (network, vCPU with TLS/compression multipliers, and Disk Cliff), expose extended per-node/edge metrics plus formula descriptors through ports, and preserve 008 compatibility and UI behavior (no new UI controls in this feature).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict), React 19

**Primary Dependencies**: Vite 8, `@xyflow/react` 12, Zustand 5, Vitest 4, oxlint

**Storage**: N/A (in-memory simulation runtime; topology JSON serialization only)

**Testing**: Vitest unit/integration tests in `test/engine/**`; deterministic seeded simulation checks

**Target Platform**: Evergreen browsers, static CSR SPA, Web Worker-hosted simulation engine

**Project Type**: Single web application (frontend + worker, no backend)

**Performance Goals**:
- Deterministic windows under fixed seed/topology/config (SC-005)
- Per-wall plateaus within ±5% of analytical ceilings (SC-001)
- Disk Cliff regime transition reproduced as abrupt threshold behavior (SC-002)

**Constraints**:
- No UI changes in feature 009 (FR-012)
- Engine core remains adapter-agnostic and pure (`src/engine/**`)
- Formula metadata must include at least one source per formula (FR-009)
- Backward compatibility with 008 topologies and tests (FR-011, SC-006)

**Scale/Scope**:
- Engine-side Kafka model only (single-broker-equivalent abstraction)
- Profiles: `m6i.large`, `m6i.xlarge`, `m6i.2xlarge`, `m6i.4xlarge`
- Roles: Kafka, producer, consumer, while preserving 008 generator/processor/sink roles

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Notes |
|---|---|---|
| I. Kafka-First Model Depth | PASS | Feature implements first deep model on Kafka only; no new deep non-Kafka models introduced. |
| II. Every Formula Is Traceable | PASS | Plan requires named pure formulas and `FormulaDescriptor` with structured sources in port payloads. |
| III. Open Source & Web-First | PASS | No backend added; worker + browser execution remains static SPA compatible. |
| IV. Simulation Core Behind Ports | PASS | Changes stay in engine contracts and worker payloads; no engine import of React/DOM/xyflow. |
| V. Render Discipline: Aggregate, Never Per-Event | PASS | Keeps per-window metrics output model; no per-event UI rendering introduced. |
| VI. Contributor-Legible Codebase | PASS | Small engine modules, explicit constants, deterministic tests, and no hidden defaults. |

Post-Phase-1 re-check: PASS. No constitution violations require complexity exceptions.

## Project Structure

### Documentation (this feature)

```text
specs/009-kafka-simulation-model/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── engine-kafka-ports.md
└── tasks.md             # Phase 2 output (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
src/
├── engine/
│   ├── ports.ts                 # role unions + metrics contracts + formula descriptors
│   ├── simulation.ts            # existing DES loop + Kafka window metrics integration
│   ├── metrics.ts               # base per-window scaling (kept)
│   ├── kafkaCatalog.ts          # sourced hardware profile catalog
│   ├── kafkaFormulas.ts         # pure formula functions + descriptor metadata
│   ├── kafkaModel.ts            # per-window Kafka model state transitions
│   └── config.ts                # centralized constants (threshold linkage)
├── sim/
│   ├── simWorker.ts             # unchanged protocol envelope, extended payloads
│   ├── workerProtocol.ts
│   └── store.ts                 # consumes extended metrics shape
└── lab/
    ├── exportDiagram.ts         # serialization whitelist compatibility for new roles/config
    └── Inspector.tsx            # compatibility-only typing guard; no new UI controls

test/
├── engine/
│   ├── kafkaSimulation.test.ts  # deterministic wall/cliff scenarios
│   ├── simulation.test.ts       # 008 behavior remains green
│   └── ...
└── fixtures/
```

**Structure Decision**: Keep all 009 work in existing engine/worker boundary (`src/engine/**`, `src/sim/**`) with no UI-surface expansion, matching feature scope and preserving future 010 Inspector rendering work.

## Phase 0: Research Plan

1. Finalize profile/source references for AWS m6i dimensions and effective disk throughput assumptions.
2. Fix explicit multiplier assumptions for TLS and zstd CPU load with citation notes.
3. Define deterministic threshold behavior for Disk Cliff and cache-overhead assumption.
4. Define formula metadata payload shape consumed by feature 010.

Output artifact: `research.md`.

## Phase 1: Design Plan

1. Define role/config/metrics/formula entities and invariants (`data-model.md`).
2. Define engine port and worker payload contract updates for Kafka model (`contracts/engine-kafka-ports.md`).
3. Define deterministic validation scenarios and smoke checks (`quickstart.md`).
4. Re-check constitution gates after concrete design.

Output artifacts: `data-model.md`, `contracts/engine-kafka-ports.md`, `quickstart.md`.

## Complexity Tracking

No constitution violations. Table intentionally empty.
