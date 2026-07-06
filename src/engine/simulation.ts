import { EventQueue } from './eventQueue'
import {
  batchSizeForSubinterval,
  buildTopologyGraph,
  detectCycle,
  drainProcessorBacklog,
  generatorUsesBatchMode,
  nextOutgoingEdgeIndex,
  type TopologyGraph,
} from './components'
import { buildMetricsWindow } from './metrics'
import {
  CycleError,
  type MetricsSinkPort,
  type Simulation,
  type SimTopology,
  type TrafficSourcePort,
} from './ports'
import { computeKafkaWindowMetrics, ensureKafkaRuntimes } from './kafkaModel'

type GeneratorEvent = { nodeId: string }

type RunStatus = 'idle' | 'running' | 'paused'

interface ProcessorRuntime {
  backlog: number
}

interface RoutingRuntime {
  lastEdgeIndex: number
}

// The DES loop: schedule/advance/drain, run lifecycle (contracts/
// engine-ports.md). `tick`-driven design keeps the engine clockless — the
// host owns wall time (worker: setInterval; tests: fixed steps), which is
// what makes SC-005 (deterministic engine tests) possible.
export function createSimulation(
  trafficSource: TrafficSourcePort,
  metricsSink: MetricsSinkPort,
  windowSizeMs: number,
): Simulation {
  let graph: TopologyGraph = buildTopologyGraph({ nodes: [], edges: [] })
  let status: RunStatus = 'idle'
  let virtualTimeMs = 0
  let timeIntoWindowMs = 0
  const queue = new EventQueue<GeneratorEvent>()
  const processorRuntimes = new Map<string, ProcessorRuntime>()
  const kafkaRuntimes = new Map<string, { lagBytes: number }>()
  const routingRuntimes = new Map<string, RoutingRuntime>()
  let nodeDepartureAccumulator = new Map<string, number>()
  let edgeCrossingAccumulator = new Map<string, number>()

  function resetRuntimeState(): void {
    queue.clear()
    processorRuntimes.clear()
    kafkaRuntimes.clear()
    routingRuntimes.clear()
    nodeDepartureAccumulator = new Map()
    edgeCrossingAccumulator = new Map()
    virtualTimeMs = 0
    timeIntoWindowMs = 0
    for (const nodeId of graph.nodeIds) {
      const sim = graph.simByNode.get(nodeId)
      if (sim?.role === 'processor') processorRuntimes.set(nodeId, { backlog: 0 })
      routingRuntimes.set(nodeId, { lastEdgeIndex: -1 })
    }
    ensureKafkaRuntimes(graph, kafkaRuntimes)
  }

  function nextGeneratorDelayMs(ratePerSec: number): number {
    return generatorUsesBatchMode(ratePerSec)
      ? windowSizeMs / 10
      : trafficSource.nextInterArrivalMs(ratePerSec)
  }

  function scheduleAllGenerators(fromMs: number): void {
    for (const nodeId of graph.generatorNodeIds) {
      const sim = graph.simByNode.get(nodeId)
      if (!sim || sim.role !== 'generator' || sim.ratePerSec <= 0) continue
      queue.schedule(fromMs + nextGeneratorDelayMs(sim.ratePerSec), { nodeId })
    }
  }

  function recordNodeDeparture(nodeId: string, count: number): void {
    if (count <= 0) return
    nodeDepartureAccumulator.set(nodeId, (nodeDepartureAccumulator.get(nodeId) ?? 0) + count)
  }

  function recordEdgeCrossing(edgeId: string, count: number): void {
    if (count <= 0) return
    edgeCrossingAccumulator.set(edgeId, (edgeCrossingAccumulator.get(edgeId) ?? 0) + count)
  }

  // Forwards `count` departed items from `nodeId` onto one outgoing edge
  // (round-robin fan-out), then delivers them to whatever is downstream.
  function forward(nodeId: string, count: number): void {
    const edgeIds = graph.outgoingEdgesByNode.get(nodeId) ?? []
    if (edgeIds.length === 0 || count <= 0) return
    const routing = routingRuntimes.get(nodeId) ?? { lastEdgeIndex: -1 }
    routing.lastEdgeIndex = nextOutgoingEdgeIndex(routing.lastEdgeIndex, edgeIds.length)
    routingRuntimes.set(nodeId, routing)
    const edgeId = edgeIds[routing.lastEdgeIndex]
    recordEdgeCrossing(edgeId, count)
    const edge = graph.edgeById.get(edgeId)
    if (edge) deliver(edge.target, count)
  }

  function deliver(nodeId: string, count: number): void {
    const sim = graph.simByNode.get(nodeId)
    if (!sim) return
    if (sim.role === 'sink') {
      recordNodeDeparture(nodeId, count)
      return
    }
    if (sim.role === 'processor') {
      const runtime = processorRuntimes.get(nodeId) ?? { backlog: 0 }
      runtime.backlog += count
      processorRuntimes.set(nodeId, runtime)
    }
    // Generators never receive traffic.
  }

  // Drains every processor's continuous backlog over `elapsedMs`,
  // recording departures/edge-crossings and forwarding them onward.
  function settleProcessors(elapsedMs: number): void {
    for (const [nodeId, runtime] of processorRuntimes) {
      const sim = graph.simByNode.get(nodeId)
      if (!sim || sim.role !== 'processor') continue
      const { remainingBacklog, departed } = drainProcessorBacklog(runtime.backlog, sim.serviceRatePerSec, elapsedMs)
      runtime.backlog = remainingBacklog
      if (departed > 0) {
        recordNodeDeparture(nodeId, departed)
        forward(nodeId, departed)
      }
    }
  }

  function processDueEvents(untilMs: number): void {
    for (;;) {
      const next = queue.peek()
      if (!next || next.timeMs > untilMs) break
      queue.popMin()
      const sim = graph.simByNode.get(next.payload.nodeId)
      if (sim?.role !== 'generator') continue
      const batchMode = generatorUsesBatchMode(sim.ratePerSec)
      const count = batchMode ? batchSizeForSubinterval(sim.ratePerSec, windowSizeMs) : 1
      if (count > 0) forward(next.payload.nodeId, count)
      if (sim.ratePerSec > 0) {
        queue.schedule(next.timeMs + nextGeneratorDelayMs(sim.ratePerSec), { nodeId: next.payload.nodeId })
      }
    }
  }

  function flushWindow(): void {
    const nodeQueueDepths = new Map<string, number>()
    for (const nodeId of graph.nodeIds) {
      const sim = graph.simByNode.get(nodeId)
      if (!sim) continue
      nodeQueueDepths.set(nodeId, sim.role === 'processor' ? (processorRuntimes.get(nodeId)?.backlog ?? 0) : 0)
    }
    const window = buildMetricsWindow({
      windowEndSimTimeMs: virtualTimeMs,
      windowSizeMs,
      nodeDepartures: nodeDepartureAccumulator,
      nodeQueueDepths,
      edgeCrossings: edgeCrossingAccumulator,
    })
    const kafkaWindow = computeKafkaWindowMetrics(graph, windowSizeMs, kafkaRuntimes)
    for (const [nodeId, nodeMetrics] of kafkaWindow.nodeMetricsById) {
      window.nodes[nodeId] = {
        ...(window.nodes[nodeId] ?? { throughputPerSec: 0, queueDepth: 0 }),
        ...nodeMetrics,
      }
    }
    for (const [edgeId, edgeMetrics] of kafkaWindow.edgeMetricsById) {
      window.edges[edgeId] = {
        ...(window.edges[edgeId] ?? { throughputPerSec: 0 }),
        ...edgeMetrics,
      }
    }
    nodeDepartureAccumulator = new Map()
    edgeCrossingAccumulator = new Map()
    metricsSink.emitWindow(window)
  }

  function advance(stepMs: number): void {
    const targetMs = virtualTimeMs + stepMs
    processDueEvents(targetMs)
    settleProcessors(stepMs)
    virtualTimeMs = targetMs
  }

  return {
    loadTopology(topology: SimTopology): void {
      const nextGraph = buildTopologyGraph(topology)
      const cycle = detectCycle(nextGraph)
      if (cycle) throw new CycleError(cycle)
      graph = nextGraph
      resetRuntimeState()
    },

    start(): void {
      if (status === 'idle') scheduleAllGenerators(virtualTimeMs)
      if (status === 'idle' || status === 'paused') status = 'running'
    },

    pause(): void {
      if (status === 'running') status = 'paused'
    },

    reset(): void {
      status = 'idle'
      resetRuntimeState()
    },

    tick(elapsedMs: number): void {
      if (status !== 'running' || elapsedMs <= 0) return
      let remaining = elapsedMs
      while (remaining > 0) {
        const remainingInWindow = windowSizeMs - timeIntoWindowMs
        const step = Math.min(remaining, remainingInWindow)
        advance(step)
        timeIntoWindowMs += step
        remaining -= step
        if (timeIntoWindowMs >= windowSizeMs) {
          flushWindow()
          timeIntoWindowMs = 0
        }
      }
    },
  }
}
