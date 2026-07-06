# Contract: Engine Kafka Ports (Feature 009)

## Scope

This contract defines engine-side data surface additions required by feature 009.

- In scope: role/config unions, runtime metrics payload extensions, formula descriptor shape.
- Out of scope: new UI controls and rendering behavior (feature 010).

## 1. SimRole Additions

```ts
type KafkaCompression = 'none' | 'zstd'
type KafkaHardwareProfileId = 'm6i.large' | 'm6i.xlarge' | 'm6i.2xlarge' | 'm6i.4xlarge'

type SimRole =
  | { role: 'generator'; ratePerSec: number }
  | { role: 'processor'; serviceRatePerSec: number }
  | {
      role: 'kafka'
      hardwareProfile: KafkaHardwareProfileId
      partitions: number
      replicationFactor: number
      tlsEnabled: boolean
      compression: KafkaCompression
      retentionBytes: number
    }
  | { role: 'producer'; messageRatePerSec: number; averagePayloadBytes: number }
  | { role: 'consumer'; consumeRatePerSec: number }
  | { role: 'sink' }
```

### Validation rules

- Producer payload size must be > 0 to support RPS -> MB/s conversion.
- Kafka `partitions` and `replicationFactor` must be >= 1.
- New roles are additive; legacy 008 roles remain valid unchanged.

## 2. Formula traceability payload

```ts
interface FormulaSource {
  title: string
  url: string
  note?: string
}

interface FormulaDescriptor {
  id: string
  name: string
  expression: string
  inputs: Record<string, number | string | boolean>
  sources: FormulaSource[]
  isBinding: boolean
}
```

### Invariants

- `sources` must contain at least one entry for every shipped formula descriptor.
- `isBinding` indicates the currently active bottleneck or regime formula.

## 3. Node and edge metrics extensions

```ts
interface KafkaNodeMetrics {
  ingressMBps: number
  egressMBps: number
  saturation: {
    network: number
    cpu: number
    disk: number
  }
  consumerLagBytes: number
  consumerLagMessages: number
  pageCacheHitRatio: number
  status: 'healthy' | 'saturated' | 'degraded'
}

interface NodeMetrics {
  throughputPerSec: number
  queueDepth: number
  kafka?: KafkaNodeMetrics
  formulaDescriptors?: FormulaDescriptor[]
}

interface EdgeMetrics {
  throughputPerSec: number
  nativeThroughputPerSec?: number
  throughputMBps?: number
}
```

### Semantics

- Kafka metrics are present only for Kafka-role nodes.
- Edge dual-unit fields are emitted for producer/consumer <-> Kafka links.
- Metrics are transient runtime values and must not be serialized into topology JSON.

## 4. Worker protocol compatibility

`MetricsWindow` payload envelope remains unchanged; only nested node/edge metric shapes are extended.

```ts
type FromWorker =
  | { type: 'window'; window: MetricsWindow }
  | { type: 'status'; status: RunStatus; message?: string }
```

This preserves adapter compatibility while enabling feature 010 to render formula/physics details from `window` data.
