// Per-window deterministic flow propagation over the simulated DAG
// (research.md D1/D5): client pools emit, each outbound edge carries its
// own independent trafficShareRatio of the source's output (NOT
// normalized across siblings — a source's edges may sum to more than 1,
// modeling sequential/parallel fan-out to multiple downstream services;
// see edgeTrafficShare in components.ts), hosts compute saturation/
// latency/shedding, queues integrate backlog, and every metric ships a
// sourced FormulaDescriptor (constitution II). Pure — no engine state
// beyond what's threaded through as arguments — so a full window can be
// exercised directly in tests without the DES event loop.

import { EDGE_CONGESTION_THRESHOLD, KB_PER_MB } from './config'
import { edgeTrafficShare, type TopologyGraph } from './components'
import { calculatedCapacityRPS, computeClientPoolMetrics, computeExternalApiMetrics, computeHostMetrics } from './hostModel'
import { computeQueueMetrics } from './queueModel'
import {
  buildEdgeCongestionDescriptor,
  buildEdgeConnectionsDescriptor,
  buildEdgeRateDescriptor,
  buildHostCapacityDescriptor,
  buildHostLatencyDescriptor,
  buildHostSaturationDescriptor,
  buildHostShedDescriptor,
  buildQueueBacklogDescriptor,
  validateFormulaDescriptorsHaveSources,
} from './formulaCatalog'
import type { EdgeMetrics, HostNodeSim, NodeMetrics, NodeSim } from './ports'

export interface FlowPropagationInput {
  graph: TopologyGraph
  windowSizeMs: number
  /** Windowed measured rate per client-pool node (from the Poisson-driven
   *  event queue's arrival count this window). */
  clientPoolMeasuredRPS: ReadonlyMap<string, number>
  /** Backlog carried over from the previous window, per queue node. */
  queueBacklogGB: ReadonlyMap<string, number>
}

export interface FlowPropagationOutput {
  nodeMetricsById: Map<string, NodeMetrics>
  edgeMetricsById: Map<string, EdgeMetrics>
  nextQueueBacklogGB: Map<string, number>
}

function isHostSim(sim: NodeSim): sim is HostNodeSim {
  return sim.kind === 'host'
}

// The ρ=1 point (data-model.md), independent of any actual traffic.
function hostCapacityRPS(sim: HostNodeSim): number {
  if (sim.profile === 'client_pool' || sim.profile === 'external_api') return Number.POSITIVE_INFINITY
  if (sim.configMode === 'manual') return Math.max(0, sim.manualSaturationRPS)
  return calculatedCapacityRPS(sim.cpuProcessingTimeMs, sim.maxWorkerThreads)
}

// How much RPS this host can still accept before shedding (research.md
// D4/D6) — only manual mode has a hard cap; calculated mode and
// external_api never shed.
function hostAcceptCapacityRPS(sim: HostNodeSim): number {
  if (sim.profile === 'client_pool') return 0
  if (sim.profile === 'external_api') return Number.POSITIVE_INFINITY
  if (sim.configMode === 'manual') return Math.max(0, sim.manualMaxRPS)
  return Number.POSITIVE_INFINITY
}

export function propagateWindow(input: FlowPropagationInput): FlowPropagationOutput {
  const { graph, windowSizeMs } = input
  const shareOfEdge = (edgeId: string) => edgeTrafficShare(graph.edgeById.get(edgeId))
  const nodeMetricsById = new Map<string, NodeMetrics>()
  const edgeMetricsById = new Map<string, EdgeMetrics>()
  const edgeOutputRPS = new Map<string, number>()
  const nextQueueBacklogGB = new Map<string, number>(input.queueBacklogGB)

  for (const nodeId of graph.topologicalOrder) {
    const sim = graph.simByNode.get(nodeId)
    if (!sim) continue
    const incomingEdgeIds = graph.incomingEdgesByNode.get(nodeId) ?? []
    const outgoingEdgeIds = graph.outgoingEdgesByNode.get(nodeId) ?? []
    let incomingRPS = 0
    for (const edgeId of incomingEdgeIds) incomingRPS += edgeOutputRPS.get(edgeId) ?? 0

    if (sim.kind === 'queue') {
      let inflowMBps = 0
      for (const edgeId of incomingEdgeIds) {
        const edge = graph.edgeById.get(edgeId)
        const rps = edgeOutputRPS.get(edgeId) ?? 0
        inflowMBps += (rps * (edge?.config.averagePayloadSizeKB ?? 0)) / KB_PER_MB
      }

      const desiredByEdge = new Map<string, number>()
      let totalDesiredMBps = 0
      let hasUnboundedEdge = false
      for (const edgeId of outgoingEdgeIds) {
        const edge = graph.edgeById.get(edgeId)
        const targetSim = edge ? graph.simByNode.get(edge.target) : undefined
        const share = shareOfEdge(edgeId)
        const acceptRPS = targetSim && isHostSim(targetSim) ? hostAcceptCapacityRPS(targetSim) : Number.POSITIVE_INFINITY
        const desiredMBps = Number.isFinite(acceptRPS) ? (acceptRPS * share * (edge?.config.averagePayloadSizeKB ?? 0)) / KB_PER_MB : Number.POSITIVE_INFINITY
        desiredByEdge.set(edgeId, desiredMBps)
        if (!Number.isFinite(desiredMBps)) hasUnboundedEdge = true
        else totalDesiredMBps += desiredMBps
      }

      const queueResult = computeQueueMetrics({
        inflowMBps,
        desiredOutflowMBps: hasUnboundedEdge ? Number.POSITIVE_INFINITY : totalDesiredMBps,
        backlogGB: nextQueueBacklogGB.get(nodeId) ?? 0,
        windowSizeMs,
      })
      nextQueueBacklogGB.set(nodeId, queueResult.backlogGB)

      for (const edgeId of outgoingEdgeIds) {
        const edge = graph.edgeById.get(edgeId)
        const desired = desiredByEdge.get(edgeId) ?? 0
        const edgeShareOfOutflow = hasUnboundedEdge || totalDesiredMBps <= 0 ? shareOfEdge(edgeId) : desired / totalDesiredMBps
        const edgeMBps = queueResult.outflowMBps * edgeShareOfOutflow
        const payloadKB = edge?.config.averagePayloadSizeKB ?? 0
        edgeOutputRPS.set(edgeId, payloadKB > 0 ? (edgeMBps * KB_PER_MB) / payloadKB : 0)
      }

      const totalOutputRPS = outgoingEdgeIds.reduce((sum, edgeId) => sum + (edgeOutputRPS.get(edgeId) ?? 0), 0)
      const backlogDescriptor = buildQueueBacklogDescriptor(queueResult)
      validateFormulaDescriptorsHaveSources([backlogDescriptor])
      nodeMetricsById.set(nodeId, {
        throughputPerSec: totalOutputRPS,
        // Messages-equivalent backlog display, in MB units (data-model.md:
        // "queues: backlog in messages-equiv") — precise per-message count
        // isn't well-defined once a queue mixes edges of different payload
        // sizes, so MB is the closest well-defined proxy.
        queueDepth: queueResult.backlogGB * 1024,
        queue: { inflowMBps: queueResult.inflowMBps, outflowMBps: queueResult.outflowMBps, backlogGB: queueResult.backlogGB },
        formulaDescriptors: [backlogDescriptor],
      })
      continue
    }

    // Host node.
    if (sim.profile === 'client_pool') {
      const metrics = computeClientPoolMetrics(input.clientPoolMeasuredRPS.get(nodeId) ?? 0)
      for (const edgeId of outgoingEdgeIds) edgeOutputRPS.set(edgeId, metrics.forwardedRPS * shareOfEdge(edgeId))
      nodeMetricsById.set(nodeId, { throughputPerSec: metrics.forwardedRPS, queueDepth: 0, host: metrics, formulaDescriptors: [] })
      continue
    }

    if (sim.profile === 'external_api') {
      const metrics = computeExternalApiMetrics(incomingRPS, sim.manualBaselineLatencyMs)
      for (const edgeId of outgoingEdgeIds) edgeOutputRPS.set(edgeId, metrics.forwardedRPS * shareOfEdge(edgeId))
      nodeMetricsById.set(nodeId, { throughputPerSec: metrics.forwardedRPS, queueDepth: 0, host: metrics, formulaDescriptors: [] })
      continue
    }

    // transactional_api / worker_consumer / database_server (manual or calculated).
    let weightedMultiplierSum = 0
    for (const edgeId of incomingEdgeIds) {
      const edge = graph.edgeById.get(edgeId)
      weightedMultiplierSum += (edgeOutputRPS.get(edgeId) ?? 0) * (edge?.config.targetComputeWeightMultiplier ?? 1)
    }
    const inboundWeightedComputeMultiplier = incomingRPS > 0 ? weightedMultiplierSum / incomingRPS : 1

    let outboundIoWeightSum = 0
    let outboundIoLatencySum = 0
    for (const edgeId of outgoingEdgeIds) {
      const edge = graph.edgeById.get(edgeId)
      const share = shareOfEdge(edgeId)
      outboundIoWeightSum += share
      outboundIoLatencySum += share * (edge?.config.pathIoLatencyMs ?? 0)
    }
    const outboundWeightedIoLatencyMs = outboundIoWeightSum > 0 ? outboundIoLatencySum / outboundIoWeightSum : 0

    const metrics = computeHostMetrics({ sim, incomingRPS, inboundWeightedComputeMultiplier, outboundWeightedIoLatencyMs })
    for (const edgeId of outgoingEdgeIds) edgeOutputRPS.set(edgeId, metrics.forwardedRPS * shareOfEdge(edgeId))

    const capacityRPS = hostCapacityRPS(sim)
    const descriptors = [
      buildHostSaturationDescriptor({ incomingRPS, capacityRPS, saturationRatio: metrics.saturationRatio }),
      buildHostLatencyDescriptor({
        baseLatencyMs: sim.configMode === 'manual' ? sim.manualBaselineLatencyMs : sim.cpuProcessingTimeMs + outboundWeightedIoLatencyMs,
        saturationRatio: metrics.saturationRatio,
        latencyMs: metrics.latencyMs,
      }),
    ]
    if (sim.configMode === 'calculated') {
      descriptors.push(buildHostCapacityDescriptor({ maxWorkerThreads: sim.maxWorkerThreads, cpuProcessingTimeMs: sim.cpuProcessingTimeMs, capacityRPS }))
    } else {
      descriptors.push(buildHostShedDescriptor({ incomingRPS, manualMaxRPS: sim.manualMaxRPS, shedRPS: metrics.shedRPS }))
    }
    validateFormulaDescriptorsHaveSources(descriptors)
    nodeMetricsById.set(nodeId, { throughputPerSec: metrics.forwardedRPS, queueDepth: 0, host: metrics, formulaDescriptors: descriptors })
  }

  // Pass 2: edge telemetry, now that every node's metrics (including
  // downstream targets, regardless of topological position) are known.
  for (const [edgeId, edge] of graph.edgeById) {
    const currentRPS = edgeOutputRPS.get(edgeId) ?? 0
    const payloadKB = edge.config.averagePayloadSizeKB
    const currentMBps = (currentRPS * payloadKB) / KB_PER_MB
    const targetMetrics = nodeMetricsById.get(edge.target)
    const targetLatencyMs = targetMetrics?.host?.latencyMs ?? 0
    const latencySec = (targetLatencyMs + edge.config.pathIoLatencyMs) / 1000
    const activeConnections = currentRPS * latencySec
    const targetSaturationRatio = targetMetrics?.host?.saturationRatio ?? 0
    const isCongested = targetSaturationRatio > EDGE_CONGESTION_THRESHOLD

    const descriptors = [
      buildEdgeRateDescriptor({ currentRPS, averagePayloadSizeKB: payloadKB, currentMBps }),
      buildEdgeConnectionsDescriptor({ currentRPS, latencySec, activeConnections }),
    ]
    if (targetMetrics?.host) descriptors.push(buildEdgeCongestionDescriptor({ targetSaturationRatio, isCongested }))
    validateFormulaDescriptorsHaveSources(descriptors)

    edgeMetricsById.set(edgeId, {
      throughputPerSec: currentRPS,
      sim: { currentRPS, currentMBps, activeConnections, isCongested },
      formulaDescriptors: descriptors,
    })
  }

  return { nodeMetricsById, edgeMetricsById, nextQueueBacklogGB }
}
