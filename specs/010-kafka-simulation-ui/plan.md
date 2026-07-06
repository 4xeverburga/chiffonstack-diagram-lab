
# Implementation Plan: Kafka Simulation UI

**Branch**: `010-kafka-simulation-ui` | **Date**: 2026-07-05 (revised after
merging feature 009, which landed while this plan was first drafted) |
**Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-kafka-simulation-ui/spec.md`

## Revision note

This plan was originally written before feature 009 existed, against a
guessed `KafkaNodeMetrics`/`FormulaDescriptor`/hardware-profile contract.
009 has since been implemented and merged into this branch
(`009-kafka-simulation-model`, see `specs/009-kafka-simulation-model/`), so
this revision replaces every guessed shape with the real one and drops the
entire fixture-first architecture: since the real engine already exists,
this feature is pure-render work against live `MetricsWindow` data — no
fixture, no resolver layer, no invented contract types.

## Summary

UI-only slice rendering the real engine-side Kafka contract feature 009
already ships: `src/engine/ports.ts`'s `kafka`/`producer`/`consumer`
`SimRole` variants, `NodeMetrics.kafka`/`.formulaDescriptors`, and
`EdgeMetrics.nativeThroughputPerSec`/`.throughputMBps` — all already
computed by `src/engine/kafkaModel.ts` and delivered through the existing
`MetricsWindow`/`store.ts` selectors (`selectNodeMetrics`,
`selectEdgeMetrics`) that 008 built and 009 populates. This feature adds:
Inspector role-selector entries and per-field config UI for the three new
roles (hardware profile picker from `kafkaCatalog.ts`'s
`KAFKA_HARDWARE_PROFILES`, partitions, replication, TLS, compression,
retention / producer rate+payload / consumer capacity), a live Kafka
metrics readout (throughput, three saturation meters, lag, page-cache hit
ratio, status badge) with binding-constraint highlighting derived from
`formulaDescriptors[].isBinding`, a token-derived canvas status treatment
for saturated/degraded nodes, dual-unit (req/s + MB/s) edge labels reading
the metrics engine already emits, and a formula & sources panel at the
bottom of the Inspector. No engine formulas, new node visual components,
or history/charts are added.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict), React 19

**Primary Dependencies**: none new — `@xyflow/react` 12, Zustand, Vitest 4,
oxlint (all already in the repo per feature 008); consumes 009's
`src/engine/kafkaCatalog.ts` (`KAFKA_HARDWARE_PROFILES`,
`resolveKafkaHardwareProfile`) and `src/engine/ports.ts` types directly —
no new engine module needed

**Storage**: none — topology JSON already serializes the new `SimRole`
fields (009's `exportDiagram.ts` whitelist extension); this feature adds no
new serialized fields

**Testing**: Vitest unit tests for every new pure function (role-config
validators, status-treatment className idempotency, the
formulaDescriptors→binding-resource mapping); manual canvas smoke check per
quickstart.md, run against the real live simulation (no fixture) for the
visual/status-treatment/panel-layout scenarios that need a browser

**Target Platform**: evergreen browsers (static CSR SPA, unchanged)

**Project Type**: single Vite SPA; all new code lives in `src/lab/` (UI)
— no `src/engine/` changes are needed by this feature, since 009 already
implemented the full contract and computation

**Performance Goals**: canvas interaction fluidity from 008 (SC-002 there)
preserved with status treatments and the formula panel active (SC-006);
metrics/panel refresh at the existing 200 ms metric-window cadence, no new
cadence introduced

**Constraints**: this feature must not modify `src/engine/kafkaModel.ts`,
`kafkaFormulas.ts`, or `kafkaCatalog.ts` (009's territory — read-only
consumption); status treatments and meters use only the existing four
design tokens plus neutral styles, distinguished by shape/badge as well as
color (accessibility fallback, spec Edge Cases); no default parameter
values (CLAUDE.md)

**Scale/Scope**: one new metrics/formula surface per selected node; the
existing 4-entry `m6i.*` hardware-profile catalog (009); demoable directly
against the real simulation by configuring rates/profiles that drive each
regime (healthy, network/cpu/disk-saturated, disk-cliff) — no fixture data
needed since 009 already exists

## Constitution Check

*GATE: evaluated against constitution v2.0.0 — pre-Phase-0 and re-checked post-Phase-1.*

| Principle | Verdict | Notes |
|---|---|---|
| I. Kafka-First Model Depth | PASS | No formulas added or changed — this feature renders `FormulaDescriptor` data produced by 009's `kafkaFormulas.ts` (spec Key Entities: "Rendered, never produced"). The `kafka`/`producer`/`consumer` `SimRole` variants and their config fields already exist (009); this feature only exposes them through the Inspector. |
| II. Every Formula Is Traceable | PASS | This is the principle's UI surface being built: the formula & sources panel (FR-008/FR-009) renders each real `FormulaDescriptor` (name, expression, inputs, `isBinding`, `sources`), plus the standing directional-accuracy disclaimer — sourced directly from spec FR-008/FR-009 and SC-004. |
| III. Open Source & Web-First | PASS | Still a static CSR SPA, no backend. No new network calls. Topology JSON's Kafka fields were already made backward compatible by 009. |
| IV. Simulation Core Behind Ports | PASS | This feature touches no `src/engine/` files — it consumes 009's already-pure contract exclusively through `src/sim/store.ts`'s existing `selectNodeMetrics`/`selectEdgeMetrics` selectors, same as 008's UI did for plain `NodeMetrics`/`EdgeMetrics`. |
| V. Render Discipline | PASS | Metrics/formula rendering reads the existing 200 ms `MetricsWindow` cadence — no new polling loop, no per-event UI updates. Status treatment is an idempotent CSS class swap (same pattern as `withHandlesVisibleClass`), not a new animated primitive. |
| VI. Contributor-Legible Codebase | PASS | New modules single-purpose and kept under ~250 lines (role validators, status-treatment derivation, binding-resource mapping, `FormulaPanel` split out of `Inspector.tsx`). All pure logic unit-tested. No default parameters. |

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
│   └── kafka-ui-contract.md   # points at 009's real contract + documents the UI-side read path
└── tasks.md                   # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── engine/                        # UNCHANGED by this feature — 009 already owns kafkaCatalog.ts /
│                                   # kafkaFormulas.ts / kafkaModel.ts / the ports.ts contract
├── lab/
│   ├── kafkaRoleValidation.ts     # NEW — pure per-field validators (partitions, replicationFactor, retentionBytes,
│   │                               # producer messageRatePerSec/averagePayloadBytes, consumer consumeRatePerSec)
│   ├── kafkaStatusTreatment.ts    # NEW — status -> idempotent className derivation (research.md pitfall note),
│   │                               # following the exact pattern already used by useHandleVisibility.ts
│   ├── kafkaBindingResource.ts    # NEW — derives which resource (network/cpu/disk) is binding from
│   │                               # NodeMetrics.formulaDescriptors[].isBinding, so the metrics panel and
│   │                               # FormulaPanel always agree (FR-005) by construction
│   ├── FormulaPanel.tsx           # NEW — bottom-of-Inspector formula & sources panel + disclaimer
│   ├── Inspector.tsx              # + kafka/producer/consumer role choices, config fields, metrics readout, mounts FormulaPanel
│   ├── HeatEdge.tsx               # + dual-unit (req/s, MB/s) edge label reading data.simMetrics.nativeThroughputPerSec/.throughputMBps
│   └── LabelNode.tsx              # + status badge (text, not color-only) alongside the label
└── App.tsx                        # renderedNodes useMemo: + idempotent status-treatment className per node
                                    # (same block that already applies withHandlesVisibleClass)

test/
├── lab/
│   ├── kafkaRoleValidation.test.ts    # NEW — validation matrix (SC-002)
│   ├── kafkaStatusTreatment.test.ts   # NEW — idempotent className derivation
│   ├── kafkaBindingResource.test.ts   # NEW — resource mapping from formulaDescriptors
│   └── FormulaPanel.test.ts           # NEW — pure view-model function (no-formulas copy, disclaimer presence)
```

**Structure Decision**: same single-SPA shape as 008/009. This feature adds
no `src/engine/` code at all — it is a pure `src/lab/` (and one `App.tsx`
wiring point) rendering layer on top of the contract 009 already shipped,
which is the cleanest possible expression of Principle IV's ports-and-
adapters boundary: the UI adapter changed, the core didn't.

## Complexity Tracking

No constitution violations — table intentionally empty.
