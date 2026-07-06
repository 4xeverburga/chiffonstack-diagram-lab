
# Data Model: Kafka Simulation UI

Entity shapes for feature 010. Shared-contract types (no behavior) live in
`src/engine/`; everything that reads/derives/renders UI state from them
lives in `src/lab/`. Serialization rules follow the existing whitelist
pattern in `exportDiagram.ts` (008 precedent).

## SimRole extension (engine, config-only — no formulas)

Three new variants join the 008 union in `src/engine/ports.ts`:

```ts
type CompressionCodec = 'none' | 'gzip' | 'lz4' | 'zstd'

type SimRole =
  | { role: 'generator'; ratePerSec: number }                    // 008
  | { role: 'processor'; serviceRatePerSec: number }              // 008
  | { role: 'sink' }                                              // 008
  | {
      role: 'kafka'
      hardwareProfileId: string       // FK into HARDWARE_PROFILES
      partitions: number              // integer ≥ 1
      replicationFactor: number       // integer ≥ 1
      tlsEnabled: boolean
      compression: CompressionCodec
      retentionHours: number          // ≥ 1
    }
  | { role: 'producer'; ratePerSec: number; avgPayloadBytes: number }   // > 0 each
  | { role: 'consumer'; capacityPerSec: number }                        // > 0
```

- Validation (FR-002, never clamped, last valid value retained):
  `partitions ≥ 1` (integer), `replicationFactor ≥ 1` (integer),
  `retentionHours ≥ 1`, `ratePerSec ≥ 0` (producer, same rule as
  generator), `avgPayloadBytes > 0`, `capacityPerSec > 0`.
- A node with no `sim` payload, or an 008 role, behaves exactly as before
  — this feature is additive to the union.
- No formula reads these fields yet (Principle I) — 009 is the first
  consumer of `hardwareProfileId`/`partitions`/etc. for real computation.

## HardwareProfile catalog (engine, static data)

```ts
// src/engine/hardwareProfiles.ts
interface HardwareProfile {
  id: string
  label: string          // e.g. "m6i.xlarge"
  vCpu: number
  ramGB: number
  networkGbps: number
  diskType: 'ssd' | 'hdd' | 'nvme'
  diskIops: number
}

const HARDWARE_PROFILES: HardwareProfile[]   // ~5 fixed entries
```

- Referenced by id from `SimRole` (kafka variant), never copied onto the
  node — the picker resolves the full row from `HARDWARE_PROFILES` by id
  for display.

## KafkaNodeMetrics / FormulaDescriptor (engine, consumed — never produced here)

```ts
// src/engine/kafkaContracts.ts
type KafkaStatus = 'healthy' | 'saturated' | 'degraded'
type BindingConstraint = 'network' | 'cpu' | 'disk' | undefined

interface KafkaNodeMetrics {
  ingressPerSec: number        // MB/s
  egressPerSec: number         // MB/s
  networkSaturation: number    // ratio, unclamped in data (UI clamps display)
  cpuSaturation: number        // ratio
  diskSaturation: number       // ratio
  consumerLagCount: number
  pageCacheHitRatio: number    // 0..1
  status: KafkaStatus
  bindingConstraint: BindingConstraint
}

interface FormulaSource {
  title: string
  url: string
  note?: string
}

interface FormulaDescriptor {
  id: string
  name: string
  expression: string                       // human-readable, e.g. "x = a / b"
  inputs: Record<string, number | string>  // current values, for display
  binding: boolean                         // true if this is the currently-limiting formula
  sources: FormulaSource[]                 // MUST be non-empty (Principle II)
}
```

- `status`/`bindingConstraint` on `KafkaNodeMetrics` and `binding` flags
  across a node's `FormulaDescriptor[]` MUST always agree (FR-005): exactly
  the formula(s) tied to `bindingConstraint`'s resource are `binding: true`.
  Enforced by a fixture self-check test (research.md D8) until 009 owns
  real production of both.

## MetricsWindow extension (engine, worker → UI)

```ts
// extends 008's MetricsWindow.nodes[id] shape
interface NodeMetrics {
  throughputPerSec: number
  queueDepth: number
  kafka?: KafkaNodeMetrics      // NEW — undefined until 009 populates it
  formulas?: FormulaDescriptor[]  // NEW — undefined until 009 populates it
}
```

- Both new fields are optional and additive; 008's existing consumers are
  unaffected.

## Fixture (UI-side, dev/test data — kept after 009 integration)

```ts
// src/lab/kafkaFixture.ts
interface KafkaFixtureEntry {
  metrics: KafkaNodeMetrics
  formulas: FormulaDescriptor[]
}

const KAFKA_FIXTURE: Record<string, KafkaFixtureEntry>
```

- Keys are stable demo node ids, one per regime: `healthy-kafka`,
  `network-saturated-kafka`, `cpu-saturated-kafka`, `disk-cliff-kafka`,
  `degraded-kafka` — matching `test/fixtures/kafka-demo-topology.json`'s
  node ids exactly, so importing that topology exercises every regime.
- Each entry's `status`/`bindingConstraint` agrees with which
  `formulas[].binding` is true (same invariant as above).

## Fixture-then-live resolver (UI-side adapter — the FR-010 "same path")

```ts
// src/lab/kafkaNodeData.ts
function resolveKafkaMetrics(nodeId: string, latestWindow: MetricsWindow | undefined): KafkaNodeMetrics | undefined
function resolveFormulas(nodeId: string, latestWindow: MetricsWindow | undefined): FormulaDescriptor[]
```

- Precedence: `latestWindow?.nodes[nodeId]?.kafka` /
  `.formulas`, else `KAFKA_FIXTURE[nodeId]`, else `undefined` / `[]`.
- Every UI consumer (metrics readout, status treatment, `FormulaPanel`,
  dual-unit edge label) calls only these two functions — no component
  branches on "fixture vs. live" itself.

## Status treatment (UI-side derivation)

```ts
// src/lab/kafkaStatusTreatment.ts
const STATUS_CLASS_PREFIX = 'sim-status-'   // sim-status-saturated | sim-status-degraded

function applyStatusTreatment(existingClassName: string | undefined, status: KafkaStatus | undefined): string
```

- MUST strip any existing `sim-status-*` token from `existingClassName`
  before appending the current one (idempotent by construction — see
  research.md D4's pitfall note). `healthy`/`undefined` → treatment
  removed entirely.
- Paired with a small text badge (not a className-only signal) rendered
  wherever the node label renders, so status is legible without color.

## Dual-unit edge conversion (engine-side, pure — no sources owed)

```ts
// src/engine/unitConversion.ts
function convertReqPerSecToMBPerSec(reqPerSec: number, avgPayloadBytes: number): number
```

- `mbPerSec = reqPerSec * avgPayloadBytes / 1_000_000`. Displayed
  alongside the native req/s value on an edge only when its source node is
  a `producer` and its target is a `kafka` node.

## Serialization rules (extends 008's table)

| Field | In topology JSON? |
|---|---|
| node `data.sim` (incl. new kafka/producer/consumer variants) | **yes** |
| node `data.simMetrics.kafka`, `.formulas` | **no** (transient, same rule as existing `simMetrics`) |
| edge dual-unit display value | **no** (derived at render time from source node config + live/fixture throughput) |
| `HARDWARE_PROFILES` catalog itself | n/a — static code, not per-diagram data; only the chosen `hardwareProfileId` is serialized |

Round-trip invariant (extends 008's): `parse(serialize(topology))` is
deep-equal on the serialized subset for every new role variant too;
invalid values are never written (rejected before `onSetNodeSimRole` is
called, same as 008).
