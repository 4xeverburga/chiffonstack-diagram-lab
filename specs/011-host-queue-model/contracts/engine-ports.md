# Contract: Engine Ports (revision for 011)

Supersedes the payload types of `specs/008-simulation-engine-skeleton/contracts/engine-ports.md`; the port *surface* is unchanged. The engine remains pure TypeScript behind three ports (constitution IV).

## Ports (unchanged surface)

```ts
interface TopologyPort {
  /** Replaces the simulated topology. Throws CycleError on cycles.
   *  Normalizes per-source edge shares at load time. */
  loadTopology(topology: SimTopology): void
}

interface TrafficSourcePort {
  /** Inter-arrival delay for a client_pool emitting at meanRatePerSec.
   *  Deterministic given the seed. */
  nextInterArrivalMs(meanRatePerSec: number): number
}

interface MetricsSinkPort {
  /** At most once per windowSizeMs of simulated time. Never per event. */
  emitWindow(window: MetricsWindow): void
}

interface Simulation extends TopologyPort {
  start(): void
  pause(): void
  reset(): void
  tick(elapsedMs: number): void
}
```

## Payload changes

| Type | 008/009 | 011 |
|---|---|---|
| Node sim | `SimRole` (6 role variants incl. `kafka`) | `HostNodeSim \| QueueNodeSim` (see data-model.md) |
| Edge | `{ id, source, target }` | `{ id, source, target, config: EdgeSimConfig }` |
| `NodeMetrics` | `{ throughputPerSec, queueDepth, kafka?, formulaDescriptors? }` | `{ throughputPerSec, queueDepth, host?, queue?, formulaDescriptors? }` |
| `EdgeMetrics` | `{ throughputPerSec, nativeThroughputPerSec?, throughputMBps? }` | `{ throughputPerSec, sim?: EdgeSimMetrics, formulaDescriptors? }` |

## Behavioral guarantees

1. **Windowing**: `emitWindow` fires at most once per `SIM_TICK_MS` of simulated time; per-window compute is O(V+E) regardless of throughput (SC-006).
2. **Determinism**: identical topology + seed + tick sequence ⇒ identical window stream (existing 008 guarantee, preserved).
3. **Propagation**: windows reflect a full topological pass — client pools emit, edges split by normalized share, hosts clamp/shed, queues integrate backlog (research D1/D5).
4. **Finiteness**: every emitted number is finite; ρ is clamped below 1 before the latency curve (D2); zero-capacity inputs yield zeros, never NaN/Infinity.
5. **Traceability**: every `host`/`queue`/`sim` metrics object is accompanied by formula descriptors whose sources are validated non-empty before emission (constitution II).
6. **Worker protocol**: `src/sim/workerProtocol.ts` message kinds are unchanged; only the payload types above evolve. UI consumes windows via the existing Zustand store snapshot path.

## Compatibility

- Old saved diagrams containing retired roles are sanitized by the import adapter (`src/lab/exportDiagram.ts`) before `loadTopology` is called; the engine never sees retired roles and MUST throw on unknown `kind` values (fail loud at the boundary).
