import { describe, expect, it } from 'vitest'
import { buildTopologyGraph } from '../../src/engine/components'
import { propagateWindow } from '../../src/engine/flowPropagation'
import type { EdgeSimConfig, SimTopology } from '../../src/engine/ports'

function edgeConfig(overrides: Partial<EdgeSimConfig> = {}): EdgeSimConfig {
  return { trafficShareRatio: 1, averagePayloadSizeKB: 1, targetComputeWeightMultiplier: 1, pathIoLatencyMs: 0, ...overrides }
}

function run(topology: SimTopology, clientPoolMeasuredRPS: Map<string, number>, queueBacklogGB: Map<string, number> = new Map()) {
  const graph = buildTopologyGraph(topology)
  return propagateWindow({ graph, windowSizeMs: 1000, clientPoolMeasuredRPS, queueBacklogGB })
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

describe('propagateWindow — performance sanity (SC-006)', () => {
  it('a 30-node topology at 10,000 req/s aggregate propagates a window in well under 50ms (O(V+E), not O(throughput))', () => {
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
        },
      })
      const source = i === 0 ? 'pool' : `host-${i - 1}`
      edges.push({ id: `${source}-${id}`, source, target: id, config: edgeConfig() })
    }
    const topology: SimTopology = { nodes, edges }
    const graph = buildTopologyGraph(topology)
    const start = performance.now()
    propagateWindow({ graph, windowSizeMs: 1000, clientPoolMeasuredRPS: new Map([['pool', 10_000]]), queueBacklogGB: new Map() })
    const elapsedMs = performance.now() - start
    expect(elapsedMs).toBeLessThan(50)
  })
})
