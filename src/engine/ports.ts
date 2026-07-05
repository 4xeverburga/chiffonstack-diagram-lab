// The hexagonal boundary for the simulation engine (constitution Principle
// IV; contracts/engine-ports.md). Everything in this file is pure,
// structured-clone-safe data plus interfaces — the engine imports nothing
// from React/DOM/xyflow/Zustand, and nothing outside src/engine/ imports
// from here except through these shapes.

/** A node's behavior in the engine, plus its configuration (data-model.md). */
export type SimRole =
  | { role: 'generator'; ratePerSec: number }
  | { role: 'processor'; serviceRatePerSec: number }
  | { role: 'sink' }

/** The engine's own view of the topology — no positions, labels, or visuals. */
export interface SimTopology {
  nodes: { id: string; sim: SimRole }[]
  edges: { id: string; source: string; target: string }[]
}

export interface NodeMetrics {
  /** Departures during the window, scaled to per-second. */
  throughputPerSec: number
  /** Instantaneous backlog at window end. */
  queueDepth: number
}

export interface EdgeMetrics {
  /** Traffic crossing the edge during the window, scaled to per-second. */
  throughputPerSec: number
}

/** One aggregated snapshot, emitted at most once per `windowSizeMs`. */
export interface MetricsWindow {
  windowEndSimTimeMs: number
  nodes: Record<string, NodeMetrics>
  edges: Record<string, EdgeMetrics>
}

/** Port 1 — into the engine. */
export interface TopologyPort {
  /** Replaces the simulated topology. Called at init and on updateTopology.
   *  Throws CycleError (with the offending node ids) if the graph has a cycle. */
  loadTopology(topology: SimTopology): void
}

/** Port 2 — into the engine. The Poisson sampler is the skeleton's only
 *  implementation; spec 009+ may add bursty/trace-driven sources without
 *  touching the engine loop. */
export interface TrafficSourcePort {
  /** Returns the next inter-arrival delay in simulated ms for a source
   *  emitting at meanRatePerSec. Deterministic given the seed. */
  nextInterArrivalMs(meanRatePerSec: number): number
}

/** Port 3 — out of the engine. */
export interface MetricsSinkPort {
  /** Called at most once per aggregation window (windowSizeMs of simulated
   *  time). Never called per event. */
  emitWindow(window: MetricsWindow): void
}

/** Thrown by loadTopology/start when the simulated subgraph has a cycle
 *  (spec edge case: the simulation must not hang or overflow). */
export class CycleError extends Error {
  readonly nodeIds: string[]

  constructor(nodeIds: string[]) {
    super(`Simulation topology contains a cycle: ${nodeIds.join(' -> ')}`)
    this.name = 'CycleError'
    this.nodeIds = nodeIds
  }
}

export interface Simulation extends TopologyPort {
  start(): void
  pause(): void
  reset(): void
  /** Advances virtual time by elapsedMs, draining due events and emitting
   *  complete windows to the MetricsSinkPort. Driven by the host's clock
   *  (worker: setInterval; tests: called directly with fixed steps). A
   *  no-op while paused or idle. */
  tick(elapsedMs: number): void
}
