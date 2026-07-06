
# Implementation Plan: Kafka Simulation UI

**Branch**: `010-kafka-simulation-ui` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-kafka-simulation-ui/spec.md`

## Summary

UI-only slice built against a static fixture of the shared `KafkaNodeMetrics`
/ `FormulaDescriptor` contract (feature 009 implements the engine side of
that same contract, in parallel). Adds three new Inspector-configurable
roles — `kafka` (hardware profile, partitions, replication, TLS,
compression, retention), `producer` (rate, avg payload size), `consumer`
(capacity) — alongside the existing 008 roles; a live Kafka metrics readout
(throughput, three saturation meters, lag, page-cache hit ratio, status
badge) with binding-constraint highlighting; a token-derived canvas status
treatment for saturated/degraded nodes; dual-unit (req/s + MB/s) edge
labels; and a formula & sources panel at the bottom of the Inspector. No
engine formulas, new node visual components, or history/charts are added —
this feature only renders a contract that 009 will start filling with real
numbers, through the exact same read path the fixture uses today.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict), React 19

**Primary Dependencies**: none new — `@xyflow/react` 12, Zustand, Vitest 4,
oxlint (all already in the repo per feature 008)

**Storage**: none — the Kafka fixture is an in-repo static TS module (no
network, no persistence); topology JSON gains new serialized role fields
only

**Testing**: Vitest unit tests for every pure function (role-config
validation, unit conversion, status/binding-constraint derivation, the
fixture-then-live resolver); manual canvas smoke check per quickstart.md
for the visual/status-treatment/panel-layout scenarios that need a browser

**Target Platform**: evergreen browsers (static CSR SPA, unchanged)

**Project Type**: single Vite SPA; all new code lives in `src/lab/` (UI) and
small pure-data additions to `src/engine/` (shared contract types only — no
behavior)

**Performance Goals**: canvas interaction fluidity from 008 (SC-002 there)
preserved with status treatments and the formula panel active (SC-006);
metrics/panel refresh at the existing 200 ms metric-window cadence, no new
cadence introduced

**Constraints**: engine core stays pure TS and formula-free for Kafka
(Principle I — this feature adds config *shapes*, not formulas); UI must be
fully demoable on the static fixture with zero code changes required when
009's engine starts populating the same fields (FR-010/SC-005); status
treatments and meters use only the existing four design tokens plus neutral
styles, distinguished by shape/badge as well as color (accessibility
fallback, spec Edge Cases); no default parameter values (CLAUDE.md)

**Scale/Scope**: one new metrics/formula surface per selected node; a fixed
small hardware-profile catalog (~5 entries); one static fixture dataset
covering 5 regimes (healthy, network-saturated, cpu-saturated, disk-cliff,
degraded) plus the existing no-role/placeholder states from 008

## Constitution Check

*GATE: evaluated against constitution v2.0.0 — pre-Phase-0 and re-checked post-Phase-1.*

| Principle | Verdict | Notes |
|---|---|---|
| I. Kafka-First Model Depth | PASS | No formulas added — this feature renders `FormulaDescriptor` data it never produces (spec Key Entities: "Rendered, never produced"). The new `kafka`/`producer`/`consumer` `SimRole` variants are config-only shapes (partitions, TLS, payload size, …), matching how 008 defined `SimRole` before any behavior existed. 009 owns the formulas that read this config. |
| II. Every Formula Is Traceable | PASS | This is the principle's UI surface being built: the formula & sources panel (FR-008/FR-009) renders name, expression, inputs, binding flag, and ≥1 source link per formula, plus the standing directional-accuracy disclaimer — sourced directly from spec FR-008/FR-009 and SC-004. |
| III. Open Source & Web-First | PASS | Still a static CSR SPA, no backend. The fixture is a bundled TS module, not a network call. Topology JSON gains new fields but stays backward compatible (old JSON has no `kafka`/`producer`/`consumer` roles and still parses as before). |
| IV. Simulation Core Behind Ports | PASS | The new contract types (`KafkaNodeMetrics`, `FormulaDescriptor`, `HardwareProfile`) live in `src/engine/` as pure data/type declarations only — no logic, no React/DOM/Zustand imports, enforced by the existing oxlint purity override. The fixture-vs-live resolver function that reads them lives in `src/lab/` (an adapter), not the engine. |
| V. Render Discipline | PASS | Metrics/formula rendering reads the existing 200 ms `MetricsWindow` cadence (extended with optional `kafka`/`formulas` fields, always `undefined` pre-009) — no new polling loop, no per-event UI updates. Status treatment is a CSS class swap, not a new animated primitive. |
| VI. Contributor-Legible Codebase | PASS | New modules single-purpose and kept under ~250 lines (hardware-profile catalog, unit conversion, status derivation, fixture, panel component split from Inspector). All pure logic unit-tested. No default parameters. |

Post-Phase-1 re-check: PASS — see `contracts/kafka-ui-contract.md`; no
violations to justify (Complexity Tracking empty).

## Project Structure

### Documentation (this feature)

```text
specs/010-kafka-simulation-ui/
├── plan.md                    # This file
├── research.md                # Phase 0 output
├── data-model.md              # Phase 1 output
├── quickstart.md              # Phase 1 output
├── contracts/
│   ├── requirements.md        # (existing) spec quality checklist
│   └── kafka-ui-contract.md   # KafkaNodeMetrics / FormulaDescriptor / HardwareProfile shapes + fixture-then-live resolver contract
└── tasks.md                   # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── engine/                        # PURE TS — contract additions only, no formulas
│   ├── ports.ts                   # + kafka/producer/consumer SimRole variants (config-only)
│   ├── kafkaContracts.ts          # NEW — KafkaNodeMetrics, FormulaDescriptor, FormulaSource, status/binding-constraint types
│   ├── hardwareProfiles.ts        # NEW — static HardwareProfile catalog (vCPU, RAM, network, disk)
│   └── unitConversion.ts          # NEW — pure reqPerSec <-> MB/s conversion (Principle I's exempt "infrastructure")
├── lab/
│   ├── kafkaFixture.ts            # NEW — static fixture: node-id -> {metrics, formulas} across every regime
│   ├── kafkaNodeData.ts           # NEW — resolveKafkaMetrics/resolveFormulas(nodeId, latestWindow): fixture fallback when live is undefined (the FR-010 "same path")
│   ├── kafkaStatusTreatment.ts    # NEW — status -> idempotent className derivation (see research.md D9 pitfall note)
│   ├── FormulaPanel.tsx           # NEW — bottom-of-Inspector formula & sources panel + disclaimer
│   ├── Inspector.tsx              # + Kafka/producer/consumer role fields, metrics readout, mounts FormulaPanel
│   ├── HeatEdge.tsx               # + dual-unit (req/s, MB/s) edge label when the edge crosses a producer->kafka boundary
│   ├── nodeKinds.ts / node render # + status-treatment className application (saturated/degraded)
│   └── exportDiagram.ts           # whitelist extended for new SimRole fields (config only, never metrics)
└── App.tsx                        # unchanged wiring; passes latestWindow through as today

test/
├── engine/
│   ├── unitConversion.test.ts     # NEW
│   └── (ports/hardwareProfiles covered by type-level + fixture tests)
├── lab/
│   ├── kafkaNodeData.test.ts      # NEW — fixture-fallback precedence, undefined-node handling
│   ├── kafkaStatusTreatment.test.ts  # NEW — idempotent className derivation
│   └── kafkaFixture.test.ts       # NEW — every regime has status/binding-constraint/​≥1 source consistency
└── fixtures/
    └── kafka-demo-topology.json   # NEW — importable demo topology whose node ids match kafkaFixture.ts, one node per regime
```

**Structure Decision**: same single-SPA shape as 008. New shared-contract
*types* (no behavior) join `src/engine/` because 009 will implement the
functions that produce them there; everything that reads/renders/derives UI
state from those types — including the fixture and its fallback resolver —
stays in `src/lab/`, kept as one small adapter module so the eventual
009-integration change (swap the resolver's fixture branch for the real
window field) touches exactly one file.

## Complexity Tracking

No constitution violations — table intentionally empty.
