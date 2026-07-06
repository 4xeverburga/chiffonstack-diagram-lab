# Data Model: Kafka Simulation Model (Feature 009)

## 1. KafkaHardwareProfile

- Purpose: Captures modeled capacity envelope for a Kafka cluster abstraction.
- Fields:
  - `id`: `'m6i.large' | 'm6i.xlarge' | 'm6i.2xlarge' | 'm6i.4xlarge'`
  - `vcpu`: number > 0
  - `ramGiB`: number > 0
  - `networkMBps`: number > 0
  - `diskMBps`: number > 0
  - `sources`: `{ vcpu: FormulaSource[]; ramGiB: FormulaSource[]; networkMBps: FormulaSource[]; diskMBps: FormulaSource[] }`
- Invariants:
  - Every numeric capacity field must have at least one source citation.

## 2. SimRole Extensions

### 2.1 Kafka Role Config

- Shape:
  - `role: 'kafka'`
  - `hardwareProfile: KafkaHardwareProfileId`
  - `partitions: number >= 1`
  - `replicationFactor: number >= 1`
  - `tlsEnabled: boolean`
  - `compression: 'none' | 'zstd'`
  - `retentionBytes: number >= 0`
- Notes:
  - Serialized in topology JSON.
  - Runtime metrics are not serialized.

### 2.2 Producer Role Config

- Shape:
  - `role: 'producer'`
  - `messageRatePerSec: number >= 0`
  - `averagePayloadBytes: number > 0`
- Notes:
  - Payload size is required for RPS -> MB/s conversion.

### 2.3 Consumer Role Config

- Shape:
  - `role: 'consumer'`
  - `consumeRatePerSec: number >= 0`

## 3. Formula Traceability Types

### 3.1 FormulaSource

- Shape:
  - `title: string`
  - `url: string`
  - `note?: string`

### 3.2 FormulaDescriptor

- Shape:
  - `id: string`
  - `name: string`
  - `expression: string`
  - `inputs: Record<string, number | string | boolean>`
  - `sources: FormulaSource[]`
  - `isBinding: boolean`
- Invariants:
  - `sources.length >= 1`
  - `isBinding` must be true only for currently active bottleneck/regime formulas.

## 4. Runtime Metrics Extensions

### 4.1 KafkaNodeMetrics

- Shape:
  - `ingressMBps: number >= 0`
  - `egressMBps: number >= 0`
  - `saturation: { network: number; cpu: number; disk: number }`
  - `consumerLagBytes: number >= 0`
  - `consumerLagMessages: number >= 0`
  - `pageCacheHitRatio: number in [0, 1]`
  - `status: 'healthy' | 'saturated' | 'degraded'`

### 4.2 NodeMetrics (extended)

- Existing fields retained:
  - `throughputPerSec: number`
  - `queueDepth: number`
- Added optional fields:
  - `kafka?: KafkaNodeMetrics`
  - `formulaDescriptors?: FormulaDescriptor[]`

### 4.3 EdgeMetrics (extended)

- Existing field retained:
  - `throughputPerSec: number`
- Added optional fields for dual units:
  - `nativeThroughputPerSec?: number`
  - `throughputMBps?: number`

## 5. Runtime State (non-serialized)

### 5.1 KafkaRuntime

- Shape:
  - `lagBytes: number >= 0`
- Notes:
  - Maintained in simulation runtime maps.
  - Reset on simulation reset/topology reload.

## 6. Derived Status Resolution

- `degraded`: Disk Cliff regime active.
- `saturated`: any saturation ratio at/above configured saturation threshold and not degraded.
- `healthy`: otherwise.
