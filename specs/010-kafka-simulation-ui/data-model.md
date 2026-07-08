
# Data Model: Kafka Simulation UI

**Revised** after merging feature 009. All engine-side shapes below are
real (`src/engine/ports.ts`, `kafkaCatalog.ts`, `kafkaFormulas.ts`,
`kafkaModel.ts`) — this feature adds no engine types, only UI-side
derivations that read them.

## SimRole (engine, already implemented by 009 — read-only for this feature)

```ts
// src/engine/ports.ts
type KafkaCompression = 'none' | 'zstd'
type KafkaHardwareProfileId = 'm6i.large' | 'm6i.xlarge' | 'm6i.2xlarge' | 'm6i.4xlarge'

type SimRole =
  | { role: 'generator'; ratePerSec: number }                    // 008
  | { role: 'processor'; serviceRatePerSec: number }              // 008
  | { role: 'sink' }                                              // 008
  | {
      role: 'kafka'
      hardwareProfile: KafkaHardwareProfileId
      partitions: number              // integer ≥ 1
      replicationFactor: number       // integer ≥ 1
      tlsEnabled: boolean
      compression: KafkaCompression   // 'none' | 'zstd' (real union — no 'gzip'/'lz4')
      retentionBytes: number          // ≥ 0
    }
  | { role: 'producer'; messageRatePerSec: number; averagePayloadBytes: number }  // payload > 0
  | { role: 'consumer'; consumeRatePerSec: number }
```

- Validation (FR-002, never clamped, last valid value retained), per the
  real contract (`specs/009-kafka-simulation-model/contracts/engine-kafka-ports.md` §1):
  `partitions ≥ 1` (integer), `replicationFactor ≥ 1` (integer),
  `retentionBytes ≥ 0`, `messageRatePerSec ≥ 0`, `averagePayloadBytes > 0`
  (required for RPS→MB/s conversion — `buildTopologyGraph` throws if
  violated, so the Inspector MUST reject this before it ever reaches the
  engine), `consumeRatePerSec ≥ 0`.
- Already fully serialized by 009's `exportDiagram.ts` whitelist — no
  further export/import work needed by this feature.
- No formula changes needed — 009's `kafkaModel.ts`/`kafkaFormulas.ts`
  already compute real numbers from this config.

## KAFKA_HARDWARE_PROFILES (engine, already implemented — read-only)

```ts
// src/engine/kafkaCatalog.ts
interface KafkaHardwareProfile {
  id: KafkaHardwareProfileId
  vcpu: number
  ramGiB: number
  networkMBps: number
  diskMBps: number
  sources: { vcpu: FormulaSource[]; ramGiB: FormulaSource[]; networkMBps: FormulaSource[]; diskMBps: FormulaSource[] }
}

const KAFKA_HARDWARE_PROFILES: Record<KafkaHardwareProfileId, KafkaHardwareProfile>
function resolveKafkaHardwareProfile(profileId: KafkaHardwareProfileId): KafkaHardwareProfile
```

- The Inspector's picker iterates `Object.values(KAFKA_HARDWARE_PROFILES)`
  and displays `vcpu`/`ramGiB`/`networkMBps`/`diskMBps` per entry (FR-001
  acceptance scenario 1); the node stores only the `hardwareProfile` id.

## KafkaNodeMetrics / FormulaDescriptor (engine, already implemented — read-only, consumed never produced)

```ts
// src/engine/ports.ts
interface KafkaNodeMetrics {
  ingressMBps: number
  egressMBps: number
  saturation: { network: number; cpu: number; disk: number }
  consumerLagBytes: number
  consumerLagMessages: number
  pageCacheHitRatio: number
  status: 'healthy' | 'saturated' | 'degraded'
}

interface FormulaSource {
  title: string
  url: string
  note?: string
}

interface FormulaDescriptor {
  id: string                                     // e.g. 'kafka.network.ingress-ceiling'
  name: string
  expression: string
  inputs: Record<string, number | string | boolean>
  sources: FormulaSource[]                        // non-empty, enforced by kafkaFormulas.ts at emit time
  isBinding: boolean
}

interface NodeMetrics {
  throughputPerSec: number
  queueDepth: number
  kafka?: KafkaNodeMetrics                        // present only for kafka-role nodes
  formulaDescriptors?: FormulaDescriptor[]
}

interface EdgeMetrics {
  throughputPerSec: number
  nativeThroughputPerSec?: number                 // req/s — present on producer/consumer<->kafka edges
  throughputMBps?: number                         // MB/s — present on producer/consumer<->kafka edges
}
```

- Already delivered to the UI through the existing `MetricsWindow` →
  `src/sim/store.ts`'s `selectNodeMetrics(window, nodeId)` /
  `selectEdgeMetrics(window, edgeId)` selectors — the exact same functions
  `App.tsx` already calls for 008's plain metrics. No new plumbing.
- `FormulaDescriptor.id` naming convention this feature relies on for the
  binding-resource derivation below: `kafka.network.*`, `kafka.cpu.*`,
  `kafka.disk.*` (ingress ceilings) and `kafka.disk-cliff.*` (cliff
  regime).

## Binding-resource derivation (UI-side, new — the only place FR-005's "agreement" is computed)

```ts
// src/lab/kafkaBindingResource.ts
type BindingResource = 'network' | 'cpu' | 'disk' | undefined

function deriveBindingResource(formulaDescriptors: FormulaDescriptor[] | undefined): BindingResource
```

- If any `kafka.disk-cliff.*` descriptor has `isBinding: true` → `'disk'`.
- Else, whichever of `kafka.network.ingress-ceiling` /
  `kafka.cpu.ingress-ceiling` / `kafka.disk.ingress-ceiling` has
  `isBinding: true` → its resource.
- Else `undefined` (healthy — nothing binding).
- Both the metrics-panel meter highlight and `FormulaPanel`'s highlighted
  row call this same function on the same `formulaDescriptors` array, so
  they agree by construction (FR-005).

## Status treatment (UI-side derivation)

```ts
// src/lab/kafkaStatusTreatment.ts
const STATUS_CLASS_PREFIX = 'sim-status-'   // sim-status-saturated | sim-status-degraded

function applyKafkaStatusClass(existingClassName: string | undefined, status: KafkaNodeMetrics['status'] | undefined): string
```

- MUST strip any existing `sim-status-*` token from `existingClassName`
  before appending the current one — same idempotent pattern already used
  by `withHandlesVisibleClass` (`src/lab/useHandleVisibility.ts`).
  `healthy`/`undefined` → treatment removed entirely.
- Paired with a small text badge (not a className-only signal) rendered
  wherever the node label renders (`LabelNode.tsx`), so status is legible
  without color.

## Role field validators (UI-side, new)

```ts
// src/lab/kafkaRoleValidation.ts
function validatePartitions(text: string): { value: number } | { error: string }
function validateReplicationFactor(text: string): { value: number } | { error: string }
function validateRetentionBytes(text: string): { value: number } | { error: string }
function validateProducerRate(text: string): { value: number } | { error: string }
function validateAveragePayloadBytes(text: string): { value: number } | { error: string }
function validateConsumeRate(text: string): { value: number } | { error: string }
```

- Rules mirror 009's own engine-side validation exactly (data-model.md's
  `SimRole` section above) so a value the Inspector accepts can never be
  rejected downstream by `buildTopologyGraph`.
- Each rejects with a specific message and never clamps, following
  `SimRoleFields`'s existing 008 pattern.

## Serialization

No changes — 009's `exportDiagram.ts` whitelist already covers every
`kafka`/`producer`/`consumer` `SimRole` field (see the merged diff in
`test/lab/exportDiagram.test.ts`). This feature does not touch
serialization.

