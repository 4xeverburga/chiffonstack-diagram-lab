# Data Model: Generalized Host/Queue Simulation Model (011)

Shapes below are the engine-port payloads (pure, structured-clone-safe). Config flows in through `TopologyPort`; telemetry flows out through `MetricsSinkPort`. **No mutable runtime fields live on canvas node objects** (constitution IV/V).

## Configuration (in)

### HostNodeSim

```ts
type HostRuntimeProfile =
  | 'client_pool'        // traffic source
  | 'transactional_api'
  | 'worker_consumer'
  | 'database_server'
  | 'external_api'       // bottomless: never saturates

type HostNodeSim =
  | { kind: 'host'; profile: 'client_pool'; requestRatePerSec: number }
  | { kind: 'host'; profile: 'external_api'; manualBaselineLatencyMs: number }
  | {
      kind: 'host'
      profile: 'transactional_api' | 'worker_consumer' | 'database_server'
      configMode: 'manual'
      manualBaselineLatencyMs: number
      manualSaturationRPS: number
      manualMaxRPS: number
    }
  | {
      kind: 'host'
      profile: 'transactional_api' | 'worker_consumer' | 'database_server'
      configMode: 'calculated'
      cpuProcessingTimeMs: number
      maxWorkerThreads: number
    }
```

Validation: all numeric fields ≥ 0; `manualMaxRPS ≥ manualSaturationRPS`; zero capacity (0 threads / 0 saturationRPS) is legal and yields zero flow (spec edge case), never a division error.

### QueueNodeSim

```ts
type QueueNodeSim = { kind: 'queue' }   // zero configuration parameters (FR-010)
```

### EdgeSimConfig

```ts
interface EdgeSimConfig {
  trafficShareRatio: number            // ≥ 0; normalized per source at load time
  averagePayloadSizeKB: number         // ≥ 0; drives RPS ↔ MB/s
  targetComputeWeightMultiplier: number // > 0; weights calculated-mode ρ
  pathIoLatencyMs: number              // ≥ 0; downstream I/O wait + Little's law input
}
```

### SimTopology

```ts
interface SimTopology {
  nodes: { id: string; sim: HostNodeSim | QueueNodeSim }[]
  edges: { id: string; source: string; target: string; config: EdgeSimConfig }[]
}
```

Rules: cycles rejected with `CycleError` (existing). Shares normalized per source when Σ ≠ 1. Retired roles never reach the engine (dropped at import, D7).

**Closed parameter enumeration (FR-020 / constitution I)**: the user-facing inputs are exactly the fields above — nothing else. `SIM_*`/threshold tunables in `src/engine/config.ts` are internal.

## Telemetry (out, per metrics window)

### HostNodeMetrics

```ts
interface HostNodeMetrics {
  incomingRPS: number
  forwardedRPS: number        // after maxRPS clamp (D6)
  shedRPS: number             // derived display value, not an input
  saturationRatio: number     // unclamped; display may exceed 1.0
  latencyMs: number           // base × (1 + ρ/(1−ρ)), ρ ≤ RHO_CLAMP (D2)
  status: 'healthy' | 'saturated' | 'overloaded'
}
```

Status derivation (thresholds in config.ts): `saturated` when ρ ≥ SATURATION_THRESHOLD, `overloaded` when offered load > maxRPS (manual) or ρ ≥ 1 (calculated).

### QueueNodeMetrics

```ts
interface QueueNodeMetrics {
  inflowMBps: number
  outflowMBps: number         // min(desired-by-consumers, inflow + backlog drain) (D4)
  backlogGB: number           // ≥ 0, unbounded above
}
```

### EdgeSimMetrics

```ts
interface EdgeSimMetrics {
  currentRPS: number          // sourceOutput × normalizedShare
  currentMBps: number         // currentRPS × payloadKB / 1024
  activeConnections: number   // Little's law: currentRPS × (latencySec of target path)
  isCongested: boolean        // target saturation > CONGESTION_THRESHOLD
}
```

### MetricsWindow (revised)

```ts
interface NodeMetrics {
  throughputPerSec: number            // kept for HeatEdge/back-compat
  queueDepth: number                  // kept; hosts: 0, queues: backlog in messages-equiv
  host?: HostNodeMetrics
  queue?: QueueNodeMetrics
  formulaDescriptors?: FormulaDescriptor[]   // unchanged shape, sourced (constitution II)
}
interface EdgeMetrics {
  throughputPerSec: number
  sim?: EdgeSimMetrics
  formulaDescriptors?: FormulaDescriptor[]
}
```

`FormulaDescriptor`/`FormulaSource` shapes are reused verbatim from 009; `validateFormulaDescriptorsHaveSources` remains the merge gate.

## Removed

`SimRole` variants `generator | processor | producer | consumer | sink | kafka`; `KafkaNodeMetrics`; `KafkaCompression`; `KafkaHardwareProfileId`; `KAFKA_*` config constants; `src/engine/kafka/*` and its tests.

## State transitions

- Host status: `healthy → saturated → overloaded` and back, purely a function of the current window (stateless).
- Queue backlog: stateful accumulator per queue node, reset on `reset()`, floored at 0 — the only cross-window engine state besides the event queue.
