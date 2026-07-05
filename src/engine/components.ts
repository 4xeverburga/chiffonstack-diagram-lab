import type { SimTopology } from './ports'

// Above this per-generator rate, per-item event scheduling would burn CPU
// for no observable difference once metrics are windowed — the generator
// switches to fixed-cadence batches instead (research.md D2).
export const GENERATOR_BATCH_RATE_THRESHOLD_PER_SEC = 5000
export const GENERATOR_BATCH_SUBINTERVALS_PER_WINDOW = 10

export interface TopologyGraph {
  nodeIds: string[]
  simByNode: Map<string, SimTopology['nodes'][number]['sim']>
  outgoingEdgesByNode: Map<string, string[]>
  edgeById: Map<string, { source: string; target: string }>
  generatorNodeIds: string[]
}

export function buildTopologyGraph(topology: SimTopology): TopologyGraph {
  const simByNode = new Map(topology.nodes.map((node) => [node.id, node.sim] as const))
  const outgoingEdgesByNode = new Map<string, string[]>()
  const edgeById = new Map<string, { source: string; target: string }>()
  for (const edge of topology.edges) {
    edgeById.set(edge.id, { source: edge.source, target: edge.target })
    const list = outgoingEdgesByNode.get(edge.source) ?? []
    list.push(edge.id)
    outgoingEdgesByNode.set(edge.source, list)
  }
  const nodeIds = topology.nodes.map((node) => node.id)
  const generatorNodeIds = topology.nodes.filter((node) => node.sim.role === 'generator').map((node) => node.id)
  return { nodeIds, simByNode, outgoingEdgesByNode, edgeById, generatorNodeIds }
}

// DFS cycle detection over the simulated subgraph (only nodes carrying a
// sim role participate). Returns the cycle's node ids (closed loop) if
// found, otherwise undefined. Iterative to avoid stack-depth surprises on
// larger topologies.
export function detectCycle(graph: TopologyGraph): string[] | undefined {
  const state = new Map<string, 'visiting' | 'done'>()

  for (const startId of graph.nodeIds) {
    if (state.get(startId) === 'done') continue
    const stack: string[] = [startId]
    const path: string[] = []

    while (stack.length > 0) {
      const nodeId = stack[stack.length - 1]
      const status = state.get(nodeId)
      if (status === undefined) {
        state.set(nodeId, 'visiting')
        path.push(nodeId)
        for (const edgeId of graph.outgoingEdgesByNode.get(nodeId) ?? []) {
          const edge = graph.edgeById.get(edgeId)
          if (!edge || !graph.simByNode.has(edge.target)) continue
          const targetStatus = state.get(edge.target)
          if (targetStatus === 'visiting') {
            const cycleStart = path.indexOf(edge.target)
            return path.slice(cycleStart).concat(edge.target)
          }
          if (targetStatus !== 'done') stack.push(edge.target)
        }
        continue
      }
      stack.pop()
      if (status === 'visiting') {
        state.set(nodeId, 'done')
        path.pop()
      }
    }
  }
  return undefined
}

// Fan-out: a node's departures split as evenly as possible across its
// outgoing edges, round-robin by call sequence (data-model.md fan-out rule).
export function nextOutgoingEdgeIndex(previousIndex: number, edgeCount: number): number {
  if (edgeCount <= 0) return 0
  return (previousIndex + 1) % edgeCount
}

// Continuous fluid drain for a placeholder processor's FIFO backlog: a
// single server that, whenever backlog > 0, clears it at a constant
// serviceRatePerSec (Principle I — visibly a placeholder, not a real
// model). Returns the amount drained over `elapsedMs`; the caller adds
// that to the departures/edge-crossing accumulators and forwards it
// onward. Using continuous drain (rather than scheduling one completion
// event per item) keeps per-arrival cost O(1) regardless of throughput,
// which is what makes SC-002 (fluid canvas at ≥10,000 req/s) possible,
// while still giving throughput = min(inputRate, serviceRate) and
// congestion/drain behavior exactly (FR-005, SC-003).
export function drainProcessorBacklog(
  backlog: number,
  serviceRatePerSec: number,
  elapsedMs: number,
): { remainingBacklog: number; departed: number } {
  if (backlog <= 0) return { remainingBacklog: 0, departed: 0 }
  const capacity = (elapsedMs / 1000) * serviceRatePerSec
  const departed = Math.min(capacity, backlog)
  return { remainingBacklog: backlog - departed, departed }
}

// Above GENERATOR_BATCH_RATE_THRESHOLD_PER_SEC, a generator emits fixed-
// cadence batches (GENERATOR_BATCH_SUBINTERVALS_PER_WINDOW per window)
// instead of one event per arrival (research.md D2).
export function generatorUsesBatchMode(ratePerSec: number): boolean {
  return ratePerSec > GENERATOR_BATCH_RATE_THRESHOLD_PER_SEC
}

// Expected item count for one batch sub-interval, given the generator's
// mean rate and the window/sub-interval sizing.
export function batchSizeForSubinterval(ratePerSec: number, windowSizeMs: number): number {
  const subIntervalSec = windowSizeMs / GENERATOR_BATCH_SUBINTERVALS_PER_WINDOW / 1000
  return Math.max(0, Math.round(ratePerSec * subIntervalSec))
}
