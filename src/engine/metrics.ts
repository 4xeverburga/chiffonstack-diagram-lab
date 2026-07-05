import type { EdgeMetrics, MetricsWindow, NodeMetrics } from './ports'

export interface MetricsWindowInput {
  windowEndSimTimeMs: number
  windowSizeMs: number
  /** Departures accumulated since the last flush, per node. */
  nodeDepartures: ReadonlyMap<string, number>
  /** Instantaneous backlog at window end, for every simulated node
   *  (0 for generator/sink — only processors carry a queue). */
  nodeQueueDepths: ReadonlyMap<string, number>
  /** Traffic that crossed each edge since the last flush. */
  edgeCrossings: ReadonlyMap<string, number>
}

// Converts the raw per-window counters the DES loop accumulates into the
// rate-scaled MetricsWindow the worker protocol carries (data-model.md).
// Pure — no engine state — so it's unit-testable directly (SC-005)
// without exercising the whole simulation loop.
export function buildMetricsWindow(input: MetricsWindowInput): MetricsWindow {
  const nodes: Record<string, NodeMetrics> = {}
  for (const [nodeId, queueDepth] of input.nodeQueueDepths) {
    const departures = input.nodeDepartures.get(nodeId) ?? 0
    nodes[nodeId] = {
      throughputPerSec: (departures / input.windowSizeMs) * 1000,
      queueDepth,
    }
  }
  const edges: Record<string, EdgeMetrics> = {}
  for (const [edgeId, crossings] of input.edgeCrossings) {
    edges[edgeId] = { throughputPerSec: (crossings / input.windowSizeMs) * 1000 }
  }
  return { windowEndSimTimeMs: input.windowEndSimTimeMs, nodes, edges }
}
