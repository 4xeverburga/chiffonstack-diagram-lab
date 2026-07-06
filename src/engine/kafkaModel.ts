import type { TopologyGraph } from './components'
import { resolveKafkaHardwareProfile } from './kafkaCatalog'
import {
  buildKafkaFormulaDescriptors,
  BYTES_PER_MB,
  cpuIngressCeilingMBps,
  deriveKafkaStatus,
  diskCliffActive,
  diskCliffReadCeilingMBps,
  diskIngressCeilingMBps,
  networkIngressCeilingMBps,
  pageCacheCapacityBytes,
  pageCacheHitRatio,
  producerIngressMBps,
  saturationRatio,
  validateFormulaDescriptorsHaveSources,
} from './kafkaFormulas'
import type { EdgeMetrics, KafkaNodeMetrics, NodeMetrics, SimRole } from './ports'

interface KafkaRuntime {
  lagBytes: number
}

export interface KafkaWindowOutput {
  nodeMetricsById: Map<string, NodeMetrics>
  edgeMetricsById: Map<string, EdgeMetrics>
}

function isProducerRole(sim: SimRole | undefined): sim is Extract<SimRole, { role: 'producer' }> {
  return sim?.role === 'producer'
}

function isConsumerRole(sim: SimRole | undefined): sim is Extract<SimRole, { role: 'consumer' }> {
  return sim?.role === 'consumer'
}

function weightedAveragePayloadBytes(
  producerEdges: Array<{ edgeId: string; messageRatePerSec: number; averagePayloadBytes: number }>,
): number {
  let weightedPayloadSum = 0
  let totalRate = 0
  for (const edge of producerEdges) {
    weightedPayloadSum += edge.messageRatePerSec * edge.averagePayloadBytes
    totalRate += edge.messageRatePerSec
  }
  if (totalRate <= 0) return 0
  return weightedPayloadSum / totalRate
}

function collectProducerEdges(graph: TopologyGraph, kafkaNodeId: string) {
  const producerEdges: Array<{ edgeId: string; messageRatePerSec: number; averagePayloadBytes: number }> = []
  for (const [edgeId, edge] of graph.edgeById) {
    if (edge.target !== kafkaNodeId) continue
    const sourceSim = graph.simByNode.get(edge.source)
    if (!isProducerRole(sourceSim) || sourceSim.averagePayloadBytes <= 0) continue
    producerEdges.push({
      edgeId,
      messageRatePerSec: Math.max(0, sourceSim.messageRatePerSec),
      averagePayloadBytes: sourceSim.averagePayloadBytes,
    })
  }
  return producerEdges
}

function collectConsumerEdges(graph: TopologyGraph, kafkaNodeId: string) {
  const consumerEdges: Array<{ edgeId: string; consumeRatePerSec: number; consumerId: string }> = []
  for (const [edgeId, edge] of graph.edgeById) {
    if (edge.source !== kafkaNodeId) continue
    const targetSim = graph.simByNode.get(edge.target)
    if (!isConsumerRole(targetSim)) continue
    consumerEdges.push({ edgeId, consumeRatePerSec: Math.max(0, targetSim.consumeRatePerSec), consumerId: edge.target })
  }
  return consumerEdges
}

export function ensureKafkaRuntimes(graph: TopologyGraph, kafkaRuntimes: Map<string, KafkaRuntime>): void {
  const activeKafkaNodeIds = new Set<string>()
  for (const nodeId of graph.nodeIds) {
    const sim = graph.simByNode.get(nodeId)
    if (sim?.role !== 'kafka') continue
    activeKafkaNodeIds.add(nodeId)
    if (!kafkaRuntimes.has(nodeId)) kafkaRuntimes.set(nodeId, { lagBytes: 0 })
  }
  for (const nodeId of kafkaRuntimes.keys()) {
    if (!activeKafkaNodeIds.has(nodeId)) kafkaRuntimes.delete(nodeId)
  }
}

export function computeKafkaWindowMetrics(
  graph: TopologyGraph,
  windowSizeMs: number,
  kafkaRuntimes: Map<string, KafkaRuntime>,
): KafkaWindowOutput {
  const nodeMetricsById = new Map<string, NodeMetrics>()
  const edgeMetricsById = new Map<string, EdgeMetrics>()
  const windowSec = windowSizeMs / 1000

  for (const nodeId of graph.nodeIds) {
    const sim = graph.simByNode.get(nodeId)
    if (sim?.role !== 'kafka') continue

    const runtime = kafkaRuntimes.get(nodeId) ?? { lagBytes: 0 }
    kafkaRuntimes.set(nodeId, runtime)

    const profile = resolveKafkaHardwareProfile(sim.hardwareProfile)
    const producerEdges = collectProducerEdges(graph, nodeId)
    const consumerEdges = collectConsumerEdges(graph, nodeId)

    const offeredIngressMBps = producerEdges.reduce(
      (sum, edge) => sum + producerIngressMBps(edge.messageRatePerSec, edge.averagePayloadBytes),
      0,
    )
    const avgPayloadBytes = weightedAveragePayloadBytes(producerEdges)

    const desiredConsumerMessageRate = consumerEdges.reduce((sum, edge) => sum + edge.consumeRatePerSec, 0)
    const desiredConsumerMBps = (desiredConsumerMessageRate * avgPayloadBytes) / BYTES_PER_MB

    const networkCeilingMBps = networkIngressCeilingMBps(profile, sim.replicationFactor)
    const cpuCeilingMBps = cpuIngressCeilingMBps(profile, sim.tlsEnabled, sim.compression, sim.partitions)
    const diskCeilingMBps = diskIngressCeilingMBps(profile)
    const ingressMBps = Math.min(offeredIngressMBps, networkCeilingMBps, cpuCeilingMBps, diskCeilingMBps)

    const cacheCapacityBytes = pageCacheCapacityBytes(profile)
    const cliffActive = diskCliffActive(runtime.lagBytes, cacheCapacityBytes)
    const diskCliffConsumerCeilingMBps = cliffActive ? diskCliffReadCeilingMBps(profile) : Number.POSITIVE_INFINITY

    const availableMBps = ingressMBps + runtime.lagBytes / BYTES_PER_MB / windowSec
    const consumerMBps = Math.min(desiredConsumerMBps, availableMBps, diskCliffConsumerCeilingMBps)

    const lagDeltaBytes = (ingressMBps - consumerMBps) * windowSec * BYTES_PER_MB
    runtime.lagBytes = Math.max(0, runtime.lagBytes + lagDeltaBytes)
    runtime.lagBytes = Math.min(runtime.lagBytes, Math.max(0, sim.retentionBytes))

    const networkSaturation = saturationRatio(offeredIngressMBps, networkCeilingMBps)
    const cpuSaturation = saturationRatio(offeredIngressMBps, cpuCeilingMBps)
    const diskSaturation = saturationRatio(offeredIngressMBps, diskCeilingMBps)
    const status = deriveKafkaStatus(cliffActive, networkSaturation, cpuSaturation, diskSaturation)

    const lagMessages = avgPayloadBytes > 0 ? runtime.lagBytes / avgPayloadBytes : 0
    const consumerMessageRate = avgPayloadBytes > 0 ? (consumerMBps * BYTES_PER_MB) / avgPayloadBytes : 0

    const kafkaMetrics: KafkaNodeMetrics = {
      ingressMBps,
      egressMBps: consumerMBps,
      saturation: {
        network: networkSaturation,
        cpu: cpuSaturation,
        disk: diskSaturation,
      },
      consumerLagBytes: runtime.lagBytes,
      consumerLagMessages: lagMessages,
      pageCacheHitRatio: pageCacheHitRatio(runtime.lagBytes, cacheCapacityBytes),
      status,
    }

    const formulaDescriptors = buildKafkaFormulaDescriptors({
      offeredIngressMBps,
      networkCeilingMBps,
      cpuCeilingMBps,
      diskCeilingMBps,
      lagBytes: runtime.lagBytes,
      cacheCapacityBytes,
      diskCliff: cliffActive,
      profile,
      tlsEnabled: sim.tlsEnabled,
      compression: sim.compression,
      partitions: sim.partitions,
      replicationFactor: sim.replicationFactor,
    })
    validateFormulaDescriptorsHaveSources(formulaDescriptors)

    nodeMetricsById.set(nodeId, {
      throughputPerSec: avgPayloadBytes > 0 ? (ingressMBps * BYTES_PER_MB) / avgPayloadBytes : 0,
      queueDepth: lagMessages,
      kafka: kafkaMetrics,
      formulaDescriptors,
    })

    for (const producerEdge of producerEdges) {
      const throughputMBps = producerIngressMBps(producerEdge.messageRatePerSec, producerEdge.averagePayloadBytes)
      edgeMetricsById.set(producerEdge.edgeId, {
        throughputPerSec: producerEdge.messageRatePerSec,
        nativeThroughputPerSec: producerEdge.messageRatePerSec,
        throughputMBps,
      })
      const producerNodeMetrics = nodeMetricsById.get(graph.edgeById.get(producerEdge.edgeId)?.source ?? '')
      if (!producerNodeMetrics) {
        const producerNodeId = graph.edgeById.get(producerEdge.edgeId)?.source
        if (producerNodeId) {
          nodeMetricsById.set(producerNodeId, {
            throughputPerSec: producerEdge.messageRatePerSec,
            queueDepth: 0,
          })
        }
      }
    }

    const totalConsumerRate = consumerEdges.reduce((sum, edge) => sum + edge.consumeRatePerSec, 0)
    for (const consumerEdge of consumerEdges) {
      const share = totalConsumerRate > 0 ? consumerEdge.consumeRatePerSec / totalConsumerRate : 0
      const edgeMessageRate = consumerMessageRate * share
      const edgeMBps = consumerMBps * share
      edgeMetricsById.set(consumerEdge.edgeId, {
        throughputPerSec: edgeMessageRate,
        nativeThroughputPerSec: edgeMessageRate,
        throughputMBps: edgeMBps,
      })
      nodeMetricsById.set(consumerEdge.consumerId, {
        throughputPerSec: edgeMessageRate,
        queueDepth: 0,
      })
    }
  }

  return { nodeMetricsById, edgeMetricsById }
}
