# Contract: Engine Ports & Worker Protocol

The hexagonal boundary for feature 008. Everything here is pure TypeScript
(structured-clone-safe data + interfaces); the engine imports nothing from
React/DOM/xyflow/Zustand (constitution Principle IV). Changes to this
contract go in a small dedicated PR, never buried inside a feature.

## Port 1 — TopologyPort (into the engine)

```ts
interface TopologyPort {
  /** Replaces the simulated topology. Called at init and on updateTopology.
   *  Throws CycleError (with the offending node ids) if the graph has a cycle. */
  loadTopology(topology: SimTopology): void
}
```

## Port 2 — TrafficSourcePort (into the engine)

Abstraction the generator components consume; the Poisson sampler is the
skeleton's only implementation. Spec 009+ may add bursty/trace-driven
sources without touching the engine loop.

```ts
interface TrafficSourcePort {
  /** Returns the next inter-arrival delay in simulated ms for a source
   *  emitting at meanRatePerSec. Deterministic given the seed. */
  nextInterArrivalMs(meanRatePerSec: number): number
}
```

## Port 3 — MetricsSinkPort (out of the engine)

```ts
interface MetricsSinkPort {
  /** Called exactly once per aggregation window (200 ms simulated).
   *  Never called per event. */
  emitWindow(window: MetricsWindow): void
}
```

## Engine entry point

```ts
function createSimulation(
  trafficSource: TrafficSourcePort,
  metricsSink: MetricsSinkPort,
  windowSizeMs: number,
): Simulation

interface Simulation extends TopologyPort {
  start(): void
  pause(): void
  reset(): void
  /** Advances virtual time by elapsedMs, draining due events and emitting
   *  complete windows to the MetricsSinkPort. Driven by the host's clock
   *  (worker: setInterval; tests: called directly with fixed steps). */
  tick(elapsedMs: number): void
}
```

`tick`-driven design keeps the engine clockless — the host owns wall time,
tests own virtual time (SC-005 determinism).

## Worker protocol (adapter layer, `src/sim/workerProtocol.ts`)

Discriminated unions over `postMessage` (structured clone):

```ts
// UI → worker
type ToWorker =
  | { type: 'init'; topology: SimTopology; windowSizeMs: number; seed: number }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'reset' }
  | { type: 'updateTopology'; topology: SimTopology }

// worker → UI
type FromWorker =
  | { type: 'window'; window: MetricsWindow }
  | { type: 'status'; status: 'idle' | 'running' | 'paused' | 'error'; message?: string }
```

Guarantees:

- Exactly one `window` message per elapsed window while running; none when
  paused/idle.
- `updateTopology` while running responds with `status: 'paused'` plus a
  message (auto-pause rule) before applying.
- All payloads structured-clone-safe; no functions, no class instances
  across the boundary.

## Purity enforcement (part of the contract)

- oxlint `no-restricted-imports` override on `src/engine/**`: bans
  `react`, `react-dom`, `@xyflow/react`, `zustand`, and any relative
  import reaching outside `src/engine/`.
- `test/engine/**` runs with Vitest `environment: 'node'`; the suite fails
  if the engine touches DOM globals.
