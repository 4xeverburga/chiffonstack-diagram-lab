import { describe, expect, it } from 'vitest'
import { buildTopologyGraph } from '../../src/engine/components'
import { propagateWindow } from '../../src/engine/flowPropagation'
import type { EdgeSimConfig, SimTopology } from '../../src/engine/ports'

function edgeConfig(overrides: Partial<EdgeSimConfig> = {}): EdgeSimConfig {
  return { trafficShareRatio: 1, averagePayloadSizeKB: 1, targetComputeWeightMultiplier: 1, pathIoLatencyMs: 0, ...overrides }
}

function run(topology: SimTopology, clientPoolMeasuredRPS: Map<string, number>, queueBacklogGB: Map<string, number> = new Map()) {
  const graph = buildTopologyGraph(topology)
  return propagateWindow({
    graph,
    windowSizeMs: 1000,
    clientPoolMeasuredRPS,
    queueBacklogGB,
    replicaRuntimeByNode: new Map(),
    simTimeMs: 0,
  })
}

describe('propagateWindow — 3-host chain (US1)', () => {
  const chain: SimTopology = {
    nodes: [
      { id: 'pool', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 100 } },
      {
        id: 'api',
        sim: {
          kind: 'host',
          profile: 'transactional_api',
          configMode: 'manual',
          manualBaselineLatencyMs: 10,
          manualSaturationRPS: 500,
          manualMaxRPS: 550,
          minReplicas: 1,
          maxReplicas: 1,
          bootDelayMs: 8000,
        },
      },
      { id: 'db', sim: { kind: 'host', profile: 'external_api', manualBaselineLatencyMs: 5 } },
    ],
    edges: [
      { id: 'pool-api', source: 'pool', target: 'api', config: edgeConfig() },
      { id: 'api-db', source: 'api', target: 'db', config: edgeConfig() },
    ],
  }

  it('propagates rate in topological order end to end', () => {
    const result = run(chain, new Map([['pool', 100]]))
    expect(result.nodeMetricsById.get('pool')?.host?.forwardedRPS).toBe(100)
    expect(result.nodeMetricsById.get('api')?.host?.incomingRPS).toBe(100)
    expect(result.nodeMetricsById.get('api')?.host?.forwardedRPS).toBeCloseTo(100, 5)
    expect(result.nodeMetricsById.get('db')?.host?.incomingRPS).toBeCloseTo(100, 5)
    expect(result.edgeMetricsById.get('pool-api')?.throughputPerSec).toBe(100)
    expect(result.edgeMetricsById.get('api-db')?.throughputPerSec).toBeCloseTo(100, 5)
  })

  it('every node/edge ships sourced formula descriptors', () => {
    const result = run(chain, new Map([['pool', 100]]))
    for (const metrics of result.nodeMetricsById.values()) {
      for (const descriptor of metrics.formulaDescriptors ?? []) expect(descriptor.sources.length).toBeGreaterThan(0)
    }
    for (const metrics of result.edgeMetricsById.values()) {
      for (const descriptor of metrics.formulaDescriptors ?? []) expect(descriptor.sources.length).toBeGreaterThan(0)
    }
  })

  it('sheds traffic beyond manualMaxRPS and does not forward the shed amount', () => {
    const result = run(chain, new Map([['pool', 700]]))
    const api = result.nodeMetricsById.get('api')?.host
    expect(api?.shedRPS).toBeCloseTo(150, 5)
    expect(api?.forwardedRPS).toBeCloseTo(550, 5)
    expect(result.nodeMetricsById.get('db')?.host?.incomingRPS).toBeCloseTo(550, 5)
  })

  it('zeros out a disconnected node not reachable by any traffic source', () => {
    const disconnected: SimTopology = {
      nodes: [...chain.nodes, { id: 'orphan', sim: { kind: 'host', profile: 'external_api', manualBaselineLatencyMs: 1 } }],
      edges: chain.edges,
    }
    const result = run(disconnected, new Map([['pool', 100]]))
    expect(result.nodeMetricsById.get('orphan')?.host?.incomingRPS).toBe(0)
    expect(result.nodeMetricsById.get('orphan')?.host?.forwardedRPS).toBe(0)
  })
})

describe('propagateWindow — fan-out share splits', () => {
  it('splits a client pool proportionally across multiple hosts by configured share', () => {
    const topology: SimTopology = {
      nodes: [
        { id: 'pool', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 1000 } },
        { id: 'a', sim: { kind: 'host', profile: 'external_api', manualBaselineLatencyMs: 1 } },
        { id: 'b', sim: { kind: 'host', profile: 'external_api', manualBaselineLatencyMs: 1 } },
      ],
      edges: [
        { id: 'pool-a', source: 'pool', target: 'a', config: edgeConfig({ trafficShareRatio: 0.7 }) },
        { id: 'pool-b', source: 'pool', target: 'b', config: edgeConfig({ trafficShareRatio: 0.3 }) },
      ],
    }
    const result = run(topology, new Map([['pool', 1000]]))
    expect(result.edgeMetricsById.get('pool-a')?.throughputPerSec).toBeCloseTo(700, 5)
    expect(result.edgeMetricsById.get('pool-b')?.throughputPerSec).toBeCloseTo(300, 5)
  })

  it('broadcasts to multiple downstream hosts unsplit when shares are not normalized (sequential/parallel fan-out, sum > 1)', () => {
    const topology: SimTopology = {
      nodes: [
        { id: 'pool', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 1000 } },
        { id: 'a', sim: { kind: 'host', profile: 'external_api', manualBaselineLatencyMs: 1 } },
        { id: 'b', sim: { kind: 'host', profile: 'external_api', manualBaselineLatencyMs: 1 } },
      ],
      edges: [
        { id: 'pool-a', source: 'pool', target: 'a', config: edgeConfig({ trafficShareRatio: 1 }) },
        { id: 'pool-b', source: 'pool', target: 'b', config: edgeConfig({ trafficShareRatio: 1 }) },
      ],
    }
    const result = run(topology, new Map([['pool', 1000]]))
    // Both edges carry the FULL upstream rate — not split 50/50 — because a
    // host making sequential/parallel calls to two downstream services
    // sends every request to both.
    expect(result.edgeMetricsById.get('pool-a')?.throughputPerSec).toBeCloseTo(1000, 5)
    expect(result.edgeMetricsById.get('pool-b')?.throughputPerSec).toBeCloseTo(1000, 5)
    expect(result.nodeMetricsById.get('a')?.host?.incomingRPS).toBeCloseTo(1000, 5)
    expect(result.nodeMetricsById.get('b')?.host?.incomingRPS).toBeCloseTo(1000, 5)
  })

  it('congestion flags the first bottleneck first: a lightly-loaded downstream host is not congested while an upstream one is', () => {
    const topology: SimTopology = {
      nodes: [
        { id: 'pool', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 490 } },
        {
          id: 'bottleneck',
          sim: {
            kind: 'host',
            profile: 'transactional_api',
            configMode: 'manual',
            manualBaselineLatencyMs: 10,
            manualSaturationRPS: 500,
            manualMaxRPS: 500,
            minReplicas: 1,
            maxReplicas: 1,
            bootDelayMs: 8000,
          },
        },
        {
          id: 'roomy',
          sim: {
            kind: 'host',
            profile: 'transactional_api',
            configMode: 'manual',
            manualBaselineLatencyMs: 10,
            manualSaturationRPS: 5000,
            manualMaxRPS: 5000,
            minReplicas: 1,
            maxReplicas: 1,
            bootDelayMs: 8000,
          },
        },
      ],
      edges: [
        { id: 'pool-bottleneck', source: 'pool', target: 'bottleneck', config: edgeConfig() },
        { id: 'bottleneck-roomy', source: 'bottleneck', target: 'roomy', config: edgeConfig() },
      ],
    }
    const result = run(topology, new Map([['pool', 490]]))
    expect(result.edgeMetricsById.get('pool-bottleneck')?.sim?.isCongested).toBe(true)
    expect(result.edgeMetricsById.get('bottleneck-roomy')?.sim?.isCongested).toBe(false)
  })
})

describe('propagateWindow — host -> queue -> host (US3)', () => {
  const topology: SimTopology = {
    nodes: [
      { id: 'pool', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 100 } },
      { id: 'queue', sim: { kind: 'queue' } },
      {
        id: 'consumer',
        sim: {
          kind: 'host',
          profile: 'worker_consumer',
          configMode: 'manual',
          manualBaselineLatencyMs: 5,
          manualSaturationRPS: 50,
          manualMaxRPS: 50,
          minReplicas: 1,
          maxReplicas: 1,
          bootDelayMs: 8000,
        },
      },
    ],
    edges: [
      { id: 'pool-queue', source: 'pool', target: 'queue', config: edgeConfig({ averagePayloadSizeKB: 200 }) },
      { id: 'queue-consumer', source: 'queue', target: 'consumer', config: edgeConfig({ averagePayloadSizeKB: 200 }) },
    ],
  }

  it('a slow consumer forces backlog to accumulate at the queue', () => {
    const result = run(topology, new Map([['pool', 100]]), new Map([['queue', 0]]))
    const queueMetrics = result.nodeMetricsById.get('queue')?.queue
    expect(queueMetrics).toBeDefined()
    expect(queueMetrics!.inflowMBps).toBeGreaterThan(queueMetrics!.outflowMBps)
  })

  it('backlog integrates window over window and drains once inflow slows', () => {
    let backlog = new Map<string, number>([['queue', 0]])
    for (let i = 0; i < 30; i += 1) {
      const result = run(topology, new Map([['pool', 100]]), backlog)
      backlog = result.nextQueueBacklogGB
    }
    const grownBacklog = backlog.get('queue') ?? 0
    expect(grownBacklog).toBeGreaterThan(0)

    for (let i = 0; i < 30; i += 1) {
      const result = run(topology, new Map([['pool', 1]]), backlog)
      backlog = result.nextQueueBacklogGB
    }
    expect(backlog.get('queue') ?? 0).toBeLessThan(grownBacklog)
  })
})

describe('propagateWindow — edge telemetry (US4)', () => {
  it('fans 1,000 req/s 0.7/0.3 into 700/300 req/s per edge', () => {
    const topology: SimTopology = {
      nodes: [
        { id: 'pool', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 1000 } },
        { id: 'a', sim: { kind: 'host', profile: 'external_api', manualBaselineLatencyMs: 1 } },
        { id: 'b', sim: { kind: 'host', profile: 'external_api', manualBaselineLatencyMs: 1 } },
      ],
      edges: [
        { id: 'pool-a', source: 'pool', target: 'a', config: edgeConfig({ trafficShareRatio: 0.7 }) },
        { id: 'pool-b', source: 'pool', target: 'b', config: edgeConfig({ trafficShareRatio: 0.3 }) },
      ],
    }
    const result = run(topology, new Map([['pool', 1000]]))
    expect(result.edgeMetricsById.get('pool-a')?.sim?.currentRPS).toBeCloseTo(700, 5)
    expect(result.edgeMetricsById.get('pool-b')?.sim?.currentRPS).toBeCloseTo(300, 5)
  })

  it('converts 100 req/s x 50KB to ~4.88 MB/s', () => {
    const topology: SimTopology = {
      nodes: [
        { id: 'pool', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 100 } },
        { id: 'a', sim: { kind: 'host', profile: 'external_api', manualBaselineLatencyMs: 1 } },
      ],
      edges: [{ id: 'pool-a', source: 'pool', target: 'a', config: edgeConfig({ averagePayloadSizeKB: 50 }) }],
    }
    const result = run(topology, new Map([['pool', 100]]))
    expect(result.edgeMetricsById.get('pool-a')?.sim?.currentMBps).toBeCloseTo(4.8828125, 3)
  })

  it("computes ~50 active connections for 200 req/s x 250ms path latency (Little's law)", () => {
    const topology: SimTopology = {
      nodes: [
        { id: 'pool', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 200 } },
        { id: 'a', sim: { kind: 'host', profile: 'external_api', manualBaselineLatencyMs: 0 } },
      ],
      edges: [{ id: 'pool-a', source: 'pool', target: 'a', config: edgeConfig({ pathIoLatencyMs: 250 }) }],
    }
    const result = run(topology, new Map([['pool', 200]]))
    expect(result.edgeMetricsById.get('pool-a')?.sim?.activeConnections).toBeCloseTo(50, 5)
  })
})

describe('propagateWindow — performance sanity (SC-006/SC-007)', () => {
  it('a 30-node topology at 10,000 req/s aggregate with 1-4 replica bounds on every host propagates a window well under 50ms', () => {
    const nodes: SimTopology['nodes'] = [{ id: 'pool', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 10_000 } }]
    const edges: SimTopology['edges'] = []
    for (let i = 0; i < 29; i += 1) {
      const id = `host-${i}`
      nodes.push({
        id,
        sim: {
          kind: 'host',
          profile: 'transactional_api',
          configMode: 'manual',
          manualBaselineLatencyMs: 5,
          manualSaturationRPS: 50_000,
          manualMaxRPS: 50_000,
          minReplicas: 1,
          maxReplicas: 4,
          bootDelayMs: 8000,
        },
      })
      const source = i === 0 ? 'pool' : `host-${i - 1}`
      edges.push({ id: `${source}-${id}`, source, target: id, config: edgeConfig() })
    }
    const topology: SimTopology = { nodes, edges }
    const graph = buildTopologyGraph(topology)
    const start = performance.now()
    propagateWindow({
      graph,
      windowSizeMs: 1000,
      clientPoolMeasuredRPS: new Map([['pool', 10_000]]),
      queueBacklogGB: new Map(),
      replicaRuntimeByNode: new Map(),
      simTimeMs: 0,
    })
    const elapsedMs = performance.now() - start
    expect(elapsedMs).toBeLessThan(50)
  })
})

describe('propagateWindow — autoscaling (feature 013)', () => {
  const boundedApi = (minReplicas: number, maxReplicas: number): SimTopology['nodes'][number] => ({
    id: 'api',
    sim: {
      kind: 'host',
      profile: 'transactional_api',
      configMode: 'manual',
      manualBaselineLatencyMs: 10,
      manualSaturationRPS: 500,
      manualMaxRPS: 500,
      minReplicas,
      maxReplicas,
    },
  })

  function topologyWith(apiNode: SimTopology['nodes'][number]): SimTopology {
    return {
      nodes: [{ id: 'pool', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 100 } }, apiNode],
      edges: [{ id: 'pool-api', source: 'pool', target: 'api', config: edgeConfig() }],
    }
  }

  function runWindowedScenario(topology: SimTopology, poolRPS: number, windowCount: number) {
    const graph = buildTopologyGraph(topology)
    let replicaRuntimeByNode = new Map()
    let queueBacklogGB = new Map<string, number>()
    const history: { simTimeMs: number; nominalCount: number | undefined; effectiveCount: number | undefined; saturationRatio: number | undefined }[] = []
    for (let i = 0; i < windowCount; i += 1) {
      const simTimeMs = (i + 1) * 1000
      const result = propagateWindow({
        graph,
        windowSizeMs: 1000,
        clientPoolMeasuredRPS: new Map([['pool', poolRPS]]),
        queueBacklogGB,
        replicaRuntimeByNode,
        simTimeMs,
      })
      replicaRuntimeByNode = result.nextReplicaRuntimeByNode
      queueBacklogGB = result.nextQueueBacklogGB
      const apiMetrics = result.nodeMetricsById.get('api')?.host
      history.push({
        simTimeMs,
        nominalCount: apiMetrics?.replicas?.nominalCount,
        effectiveCount: apiMetrics?.replicas?.effectiveCount,
        saturationRatio: apiMetrics?.saturationRatio,
      })
    }
    return history
  }

  it('US1: sustained high saturation scales 1 -> 2 with a visible boot-delay lag before capacity relief', () => {
    // 490 req/s against a 500 req/s single-replica cap => rho ~0.98, well
    // above the high watermark, so the scaler should add a replica.
    const history = runWindowedScenario(topologyWith(boundedApi(1, 4)), 490, 30)
    const scaleUpIndex = history.findIndex((entry, index) => index > 0 && (entry.nominalCount ?? 0) > (history[index - 1].nominalCount ?? 0))
    expect(scaleUpIndex).toBeGreaterThan(0)
    // Nominal count rises immediately, but effective (serving) count lags
    // behind until the boot delay elapses (spec FR-006).
    expect(history[scaleUpIndex].nominalCount).toBe(2)
    expect(history[scaleUpIndex].effectiveCount).toBe(1)
    const bootCompleteIndex = history.findIndex((entry, index) => index > scaleUpIndex && (entry.effectiveCount ?? 0) === 2)
    expect(bootCompleteIndex).toBeGreaterThan(scaleUpIndex)
    // Once the second replica serves, per-replica saturation roughly halves.
    expect(history[bootCompleteIndex].saturationRatio).toBeLessThan(history[scaleUpIndex].saturationRatio!)
  })

  it('US2: dropping load after scaling out eventually scales back to minReplicas', () => {
    let history = runWindowedScenario(topologyWith(boundedApi(1, 4)), 490, 40)
    const scaledUpCount = history.at(-1)?.nominalCount ?? 1
    expect(scaledUpCount).toBeGreaterThan(1)
    // Re-run the full ramp-up-then-drop as one continuous scenario so the
    // scaler's runtime state carries over exactly like flushWindow would.
    const graph = buildTopologyGraph(topologyWith(boundedApi(1, 4)))
    let replicaRuntimeByNode = new Map()
    let queueBacklogGB = new Map<string, number>()
    let last: ReturnType<typeof propagateWindow> | undefined
    for (let i = 0; i < 40; i += 1) {
      last = propagateWindow({
        graph,
        windowSizeMs: 1000,
        clientPoolMeasuredRPS: new Map([['pool', 490]]),
        queueBacklogGB,
        replicaRuntimeByNode,
        simTimeMs: (i + 1) * 1000,
      })
      replicaRuntimeByNode = last.nextReplicaRuntimeByNode
      queueBacklogGB = last.nextQueueBacklogGB
    }
    for (let i = 40; i < 120; i += 1) {
      last = propagateWindow({
        graph,
        windowSizeMs: 1000,
        clientPoolMeasuredRPS: new Map([['pool', 5]]),
        queueBacklogGB,
        replicaRuntimeByNode,
        simTimeMs: (i + 1) * 1000,
      })
      replicaRuntimeByNode = last.nextReplicaRuntimeByNode
      queueBacklogGB = last.nextQueueBacklogGB
    }
    expect(last?.nodeMetricsById.get('api')?.host?.replicas?.nominalCount).toBe(1)
    history = []
  })

  it('US3: minReplicas = maxReplicas = 1 never emits a scaling event and is bit-identical to pre-013 output (SC-003)', () => {
    const history = runWindowedScenario(topologyWith(boundedApi(1, 1)), 490, 30)
    expect(history.every((entry) => entry.nominalCount === 1 && entry.effectiveCount === 1)).toBe(true)
    const scaled = run(topologyWith(boundedApi(1, 1)), new Map([['pool', 490]]))
    const unscaledEquivalent = run(
      {
        nodes: [
          { id: 'pool', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 100 } },
          {
            id: 'api',
            sim: {
              kind: 'host',
              profile: 'transactional_api',
              configMode: 'manual',
              manualBaselineLatencyMs: 10,
              manualSaturationRPS: 500,
              manualMaxRPS: 500,
              minReplicas: 1,
              maxReplicas: 1,
              bootDelayMs: 8000,
            },
          },
        ],
        edges: [{ id: 'pool-api', source: 'pool', target: 'api', config: edgeConfig() }],
      },
      new Map([['pool', 490]]),
    )
    expect(scaled.nodeMetricsById.get('api')?.host?.saturationRatio).toBeCloseTo(unscaledEquivalent.nodeMetricsById.get('api')?.host?.saturationRatio ?? -1, 10)
    expect(scaled.nodeMetricsById.get('api')?.host?.forwardedRPS).toBeCloseTo(unscaledEquivalent.nodeMetricsById.get('api')?.host?.forwardedRPS ?? -1, 10)
  })

  it('US3: minReplicas = maxReplicas = 3 divides load by 3 with zero scaling events ever', () => {
    const history = runWindowedScenario(topologyWith(boundedApi(3, 3)), 490, 30)
    expect(history.every((entry) => entry.nominalCount === 3 && entry.effectiveCount === 3)).toBe(true)
    const last = history.at(-1)
    // 490 req/s / 3 replicas ~= 163.3 req/s per replica => rho ~0.327, far
    // below the 500 req/s single-replica saturation point.
    expect(last?.saturationRatio).toBeCloseTo(490 / 3 / 500, 3)
  })

  it('FR-011: a queue draining into a scaled consumer accepts effectiveCount x per-replica remaining capacity', () => {
    const topology: SimTopology = {
      nodes: [
        { id: 'pool', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 1000 } },
        { id: 'queue', sim: { kind: 'queue' } },
        {
          id: 'consumer',
          sim: {
            kind: 'host',
            profile: 'worker_consumer',
            configMode: 'manual',
            manualBaselineLatencyMs: 5,
            manualSaturationRPS: 50,
            manualMaxRPS: 50,
            minReplicas: 3,
            maxReplicas: 3,
            bootDelayMs: 8000,
          },
        },
      ],
      edges: [
        { id: 'pool-queue', source: 'pool', target: 'queue', config: edgeConfig({ averagePayloadSizeKB: 1 }) },
        { id: 'queue-consumer', source: 'queue', target: 'consumer', config: edgeConfig({ averagePayloadSizeKB: 1 }) },
      ],
    }
    const graph = buildTopologyGraph(topology)
    const result = propagateWindow({
      graph,
      windowSizeMs: 1000,
      clientPoolMeasuredRPS: new Map([['pool', 1000]]),
      queueBacklogGB: new Map([['queue', 0]]),
      replicaRuntimeByNode: new Map(),
      simTimeMs: 1000,
    })
    // 3 replicas x 50 req/s cap = 150 req/s accepted from the queue.
    expect(result.edgeMetricsById.get('queue-consumer')?.sim?.currentRPS).toBeCloseTo(150, 3)
    expect(result.nodeMetricsById.get('consumer')?.host?.forwardedRPS).toBeCloseTo(150, 3)
  })
})

