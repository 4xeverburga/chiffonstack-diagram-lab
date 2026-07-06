
# Contract: Kafka UI ↔ Engine Metrics/Formula Shapes

This is the shared contract between feature 010 (this feature, UI-only)
and feature 009 (engine model, developed in parallel). It is the concrete
version of the shapes the spec's Assumptions section calls "owned by 009's
spec" — since 009 doesn't exist yet at the time this plan was written, this
feature defines the initial version; both features read this document as
the source of truth going forward, and any change to it after both have
landed ships as the spec's "small dedicated contract PR."

## Types (defined in `src/engine/kafkaContracts.ts`, pure TS, no logic)

```ts
export type KafkaStatus = 'healthy' | 'saturated' | 'degraded'
export type BindingConstraint = 'network' | 'cpu' | 'disk' | undefined

export interface KafkaNodeMetrics {
  ingressPerSec: number
  egressPerSec: number
  networkSaturation: number
  cpuSaturation: number
  diskSaturation: number
  consumerLagCount: number
  pageCacheHitRatio: number
  status: KafkaStatus
  bindingConstraint: BindingConstraint
}

export interface FormulaSource {
  title: string
  url: string
  note?: string
}

export interface FormulaDescriptor {
  id: string
  name: string
  expression: string
  inputs: Record<string, number | string>
  binding: boolean
  sources: FormulaSource[]   // non-empty — Principle II gate
}
```

## Hardware profile catalog (defined in `src/engine/hardwareProfiles.ts`)

```ts
export interface HardwareProfile {
  id: string
  label: string
  vCpu: number
  ramGB: number
  networkGbps: number
  diskType: 'ssd' | 'hdd' | 'nvme'
  diskIops: number
}

export const HARDWARE_PROFILES: HardwareProfile[]
```

## Engine-side extension point (`src/engine/ports.ts`)

`NodeMetrics` gains two optional fields that only feature 009 populates for
real:

```ts
export interface NodeMetrics {
  throughputPerSec: number
  queueDepth: number
  kafka?: KafkaNodeMetrics
  formulas?: FormulaDescriptor[]
}
```

**Obligation on feature 009**: when a `kafka`-role node's window is
emitted, populate `kafka` and `formulas` following the shapes above,
keeping `status`/`bindingConstraint` consistent with which
`formulas[].binding` are true (data-model.md's invariant). No UI change is
required on 010's side when this happens — see the resolver contract below.

## UI-side read contract (`src/lab/kafkaNodeData.ts`)

```ts
export function resolveKafkaMetrics(
  nodeId: string,
  latestWindow: MetricsWindow | undefined,
): KafkaNodeMetrics | undefined

export function resolveFormulas(
  nodeId: string,
  latestWindow: MetricsWindow | undefined,
): FormulaDescriptor[]
```

- Precedence: live window field, else the static fixture
  (`src/lab/kafkaFixture.ts`), else `undefined`/`[]`.
- **This function pair is the entire integration surface with 009.** No
  other file in `src/lab/` may read `KAFKA_FIXTURE` directly, and no other
  file may read `latestWindow?.nodes[id]?.kafka` directly — every
  metrics/formula/status/dual-unit consumer goes through these two
  functions. This is what makes FR-010/SC-005 ("no UI rework on 009
  integration") mechanically true rather than aspirational.

## Fixture data contract (`src/lab/kafkaFixture.ts`)

- Keys are stable node ids: `healthy-kafka`, `network-saturated-kafka`,
  `cpu-saturated-kafka`, `disk-cliff-kafka`, `degraded-kafka`.
- Every entry MUST have ≥1 `FormulaSource` per `FormulaDescriptor` and a
  `status`/`bindingConstraint`/`binding` set that agrees (see
  data-model.md invariant) — enforced by a self-check unit test
  (`test/lab/kafkaFixture.test.ts`).
- `test/fixtures/kafka-demo-topology.json` uses exactly these node ids so
  importing it via the existing topology-import feature demonstrates every
  regime without any code change.

## Non-contract (explicitly out of scope for this document)

- The actual formulas that compute real `KafkaNodeMetrics`/`FormulaDescriptor`
  values from `SimRole` config and simulated traffic — feature 009's job.
- Any change to `SimTopology`, `TopologyPort`, `TrafficSourcePort`,
  `MetricsSinkPort`, or the DES loop itself — untouched by this feature.
