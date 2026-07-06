
# Contract: Kafka UI ↔ Engine (consuming feature 009)

**Revised**: feature 009 (`009-kafka-simulation-model`) is merged into this
branch. The real, authoritative contract lives at
[specs/009-kafka-simulation-model/contracts/engine-kafka-ports.md](../../009-kafka-simulation-model/contracts/engine-kafka-ports.md)
and the implementation at `src/engine/ports.ts`, `kafkaCatalog.ts`,
`kafkaFormulas.ts`, `kafkaModel.ts`. This document no longer defines those
types (the original draft version did, since 009 didn't exist yet) — it
now only documents how feature 010 reads them.

## What this feature reads (all already implemented, read-only)

- `SimRole`'s `kafka`/`producer`/`consumer` variants — `src/engine/ports.ts`.
- `KAFKA_HARDWARE_PROFILES` / `resolveKafkaHardwareProfile` — `src/engine/kafkaCatalog.ts`.
- `NodeMetrics.kafka: KafkaNodeMetrics | undefined` and
  `NodeMetrics.formulaDescriptors: FormulaDescriptor[] | undefined` — via
  `src/sim/store.ts`'s `selectNodeMetrics(latestWindow, nodeId)`, the same
  selector 008's UI already uses for plain metrics.
- `EdgeMetrics.nativeThroughputPerSec` / `.throughputMBps` — via
  `selectEdgeMetrics(latestWindow, edgeId)`, already merged onto every
  rendered edge's `data.simMetrics` in `App.tsx`.

**No new resolver, fixture, or engine module is introduced by this
feature.** Every UI component that needs Kafka data calls the existing
selectors directly (exactly like 008's `SimRoleFields`/`HeatEdge` already
do for non-Kafka metrics) — there is nothing left to bridge.

## What this feature adds (`src/lab/`, pure UI-side logic)

```ts
// src/lab/kafkaRoleValidation.ts — per-field validators mirroring 009's own
// engine-side rules (partitions/replicationFactor >= 1, averagePayloadBytes > 0, etc.)
function validatePartitions(text: string): { value: number } | { error: string }
// ...one such function per new field (see data-model.md)

// src/lab/kafkaBindingResource.ts — the one piece of derived logic this
// feature owns: which resource (network/cpu/disk) is currently binding,
// read from formulaDescriptors[].isBinding rather than a dedicated field
// (009's KafkaNodeMetrics has none) — this is what makes the metrics panel
// and FormulaPanel agree (FR-005).
function deriveBindingResource(formulaDescriptors: FormulaDescriptor[] | undefined): 'network' | 'cpu' | 'disk' | undefined

// src/lab/kafkaStatusTreatment.ts — idempotent className derivation,
// following the exact pattern already used by withHandlesVisibleClass.
function applyKafkaStatusClass(existingClassName: string | undefined, status: KafkaNodeMetrics['status'] | undefined): string
```

## Non-contract (still explicitly out of scope for this feature)

- Any change to `kafkaModel.ts`/`kafkaFormulas.ts`/`kafkaCatalog.ts`
  (009's territory).
- Any change to `SimTopology`, `TopologyPort`, `TrafficSourcePort`,
  `MetricsSinkPort`, or the DES loop itself.
- Adding a `bindingConstraint` field to `KafkaNodeMetrics` — see
  data-model.md's binding-resource derivation for why this is handled
  UI-side instead.

