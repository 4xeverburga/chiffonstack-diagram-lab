import { describe, expect, it } from 'vitest'
import { createSimulation } from '../../../src/engine/simulation'
import { mulberry32, PoissonTrafficSource } from '../../../src/engine/poisson'
import type { MetricsSinkPort, MetricsWindow, SimTopology } from '../../../src/engine/ports'

function collectingSink(): { sink: MetricsSinkPort; windows: MetricsWindow[] } {
  const windows: MetricsWindow[] = []
  return { sink: { emitWindow: (window) => windows.push(window) }, windows }
}

function runKafkaTopology(topology: SimTopology, simulatedMs: number): MetricsWindow {
  const { sink, windows } = collectingSink()
  const simulation = createSimulation(new PoissonTrafficSource(mulberry32(7)), sink, 200)
  simulation.loadTopology(topology)
  simulation.start()
  simulation.tick(simulatedMs)
  const last = windows.at(-1)
  if (!last) throw new Error('Expected at least one emitted metrics window.')
  return last
}

describe('Kafka simulation model saturation walls', () => {
  it('reports healthy status with low saturation under offered load below all ceilings', () => {
    const topology: SimTopology = {
      nodes: [
        { id: 'producer', sim: { role: 'producer', messageRatePerSec: 1_000, averagePayloadBytes: 1_000 } },
        {
          id: 'kafka',
          sim: {
            role: 'kafka',
            hardwareProfile: 'm6i.xlarge',
            partitions: 12,
            replicationFactor: 1,
            tlsEnabled: false,
            compression: 'none',
            retentionBytes: 500_000_000_000,
          },
        },
        { id: 'consumer', sim: { role: 'consumer', consumeRatePerSec: 1_000 } },
      ],
      edges: [
        { id: 'p-k', source: 'producer', target: 'kafka' },
        { id: 'k-c', source: 'kafka', target: 'consumer' },
      ],
    }

    const last = runKafkaTopology(topology, 10_000)
    const kafka = last.nodes.kafka.kafka!
    expect(kafka.status).toBe('healthy')
    expect(kafka.ingressMBps).toBeCloseTo(1, 6)
    expect(kafka.saturation.network).toBeLessThan(0.7)
    expect(kafka.saturation.cpu).toBeLessThan(0.7)
    expect(kafka.saturation.disk).toBeLessThan(0.7)
    expect(kafka.consumerLagBytes).toBeCloseTo(0, 3)
    expect(last.edges['p-k'].nativeThroughputPerSec).toBeCloseTo(1_000, 6)
    expect(last.edges['p-k'].throughputMBps).toBeCloseTo(1, 6)
  })

  it('pins network saturation when replication traffic is the binding wall', () => {
    const topology: SimTopology = {
      nodes: [
        { id: 'producer', sim: { role: 'producer', messageRatePerSec: 900_000, averagePayloadBytes: 1000 } },
        {
          id: 'kafka',
          sim: {
            role: 'kafka',
            hardwareProfile: 'm6i.xlarge',
            partitions: 12,
            replicationFactor: 4,
            tlsEnabled: false,
            compression: 'none',
            retentionBytes: 500_000_000_000,
          },
        },
        { id: 'consumer', sim: { role: 'consumer', consumeRatePerSec: 900_000 } },
      ],
      edges: [
        { id: 'p-k', source: 'producer', target: 'kafka' },
        { id: 'k-c', source: 'kafka', target: 'consumer' },
      ],
    }

    const last = runKafkaTopology(topology, 2_000)
    const kafka = last.nodes.kafka.kafka
    expect(kafka).toBeDefined()
    expect(kafka!.saturation.network).toBeGreaterThanOrEqual(1)
    expect(kafka!.saturation.network).toBeGreaterThan(kafka!.saturation.cpu)
    expect(kafka!.saturation.network).toBeGreaterThan(kafka!.saturation.disk)
    expect(kafka!.status).toBe('saturated')
    expect(kafka!.ingressMBps).toBeCloseTo(390.625, 6)
  })

  it('pins CPU saturation and lowers ceiling when TLS + zstd are enabled', () => {
    const baseNodes = [
      { id: 'producer', sim: { role: 'producer', messageRatePerSec: 450_000, averagePayloadBytes: 1000 } as const },
      { id: 'consumer', sim: { role: 'consumer', consumeRatePerSec: 450_000 } as const },
    ]

    const tlsOff: SimTopology = {
      nodes: [
        ...baseNodes,
        {
          id: 'kafka',
          sim: {
            role: 'kafka',
            hardwareProfile: 'm6i.xlarge',
            partitions: 12,
            replicationFactor: 1,
            tlsEnabled: false,
            compression: 'none',
            retentionBytes: 500_000_000_000,
          },
        },
      ],
      edges: [
        { id: 'p-k', source: 'producer', target: 'kafka' },
        { id: 'k-c', source: 'kafka', target: 'consumer' },
      ],
    }

    const tlsOn: SimTopology = {
      ...tlsOff,
      nodes: [
        ...baseNodes,
        {
          id: 'kafka',
          sim: {
            role: 'kafka',
            hardwareProfile: 'm6i.xlarge',
            partitions: 12,
            replicationFactor: 1,
            tlsEnabled: true,
            compression: 'zstd',
            retentionBytes: 500_000_000_000,
          },
        },
      ],
    }

    const offWindow = runKafkaTopology(tlsOff, 2_000)
    const onWindow = runKafkaTopology(tlsOn, 2_000)
    const off = offWindow.nodes.kafka.kafka!
    const on = onWindow.nodes.kafka.kafka!

    expect(on.saturation.cpu).toBeGreaterThan(off.saturation.cpu)
    expect(on.saturation.cpu).toBeGreaterThanOrEqual(1)
    expect(on.status).toBe('saturated')
    expect(on.ingressMBps).toBeLessThan(off.ingressMBps)
    expect(on.ingressMBps).toBeCloseTo(365.213422, 6)
  })

  it('pins disk saturation when broker disk throughput is the tightest ceiling', () => {
    const topology: SimTopology = {
      nodes: [
        { id: 'producer', sim: { role: 'producer', messageRatePerSec: 2_400_000, averagePayloadBytes: 1000 } },
        {
          id: 'kafka',
          sim: {
            role: 'kafka',
            hardwareProfile: 'm6i.4xlarge',
            partitions: 12,
            replicationFactor: 1,
            tlsEnabled: false,
            compression: 'none',
            retentionBytes: 500_000_000_000,
          },
        },
        { id: 'consumer', sim: { role: 'consumer', consumeRatePerSec: 2_400_000 } },
      ],
      edges: [
        { id: 'p-k', source: 'producer', target: 'kafka' },
        { id: 'k-c', source: 'kafka', target: 'consumer' },
      ],
    }

    const last = runKafkaTopology(topology, 2_000)
    const kafka = last.nodes.kafka.kafka!
    expect(kafka.saturation.disk).toBeGreaterThanOrEqual(1)
    expect(kafka.saturation.disk).toBeGreaterThan(kafka.saturation.network)
    expect(kafka.saturation.disk).toBeGreaterThan(kafka.saturation.cpu)
    expect(kafka.status).toBe('saturated')
    expect(kafka.ingressMBps).toBeCloseTo(2000, 6)
  })
})

describe('Kafka simulation model disk cliff', () => {
  it('switches from cached reads to disk-bound reads once lag exceeds cache capacity', () => {
    const topology: SimTopology = {
      nodes: [
        { id: 'producer', sim: { role: 'producer', messageRatePerSec: 350_000, averagePayloadBytes: 1000 } },
        {
          id: 'kafka',
          sim: {
            role: 'kafka',
            hardwareProfile: 'm6i.xlarge',
            partitions: 12,
            replicationFactor: 1,
            tlsEnabled: false,
            compression: 'none',
            retentionBytes: 500_000_000_000,
          },
        },
        { id: 'consumer', sim: { role: 'consumer', consumeRatePerSec: 200_000 } },
      ],
      edges: [
        { id: 'p-k', source: 'producer', target: 'kafka' },
        { id: 'k-c', source: 'kafka', target: 'consumer' },
      ],
    }

    const preCliff = runKafkaTopology(topology, 10_000)
    const postCliff = runKafkaTopology(topology, 120_000)

    const pre = preCliff.nodes.kafka.kafka!
    const post = postCliff.nodes.kafka.kafka!

    expect(pre.status).toBe('healthy')
    expect(pre.pageCacheHitRatio).toBe(1)
    expect(pre.egressMBps).toBeCloseTo(200, 6)

    expect(post.status).toBe('degraded')
    expect(post.pageCacheHitRatio).toBeLessThan(0.2)
    expect(post.consumerLagBytes).toBeGreaterThan(pre.consumerLagBytes)
    expect(post.egressMBps).toBeCloseTo(100, 6)
  })

  it('caps lag by retention when consumers are absent', () => {
    const topology: SimTopology = {
      nodes: [
        { id: 'producer', sim: { role: 'producer', messageRatePerSec: 500_000, averagePayloadBytes: 1_000 } },
        {
          id: 'kafka',
          sim: {
            role: 'kafka',
            hardwareProfile: 'm6i.xlarge',
            partitions: 12,
            replicationFactor: 1,
            tlsEnabled: false,
            compression: 'none',
            retentionBytes: 10_000_000,
          },
        },
      ],
      edges: [{ id: 'p-k', source: 'producer', target: 'kafka' }],
    }

    const last = runKafkaTopology(topology, 60_000)
    const kafka = last.nodes.kafka.kafka!
    expect(kafka.consumerLagBytes).toBeLessThanOrEqual(10_000_000)
  })

  it('rejects a producer configured with zero payload size at topology load', () => {
    const { sink } = collectingSink()
    const simulation = createSimulation(new PoissonTrafficSource(mulberry32(7)), sink, 200)
    const invalidTopology: SimTopology = {
      nodes: [
        { id: 'producer', sim: { role: 'producer', messageRatePerSec: 1_000, averagePayloadBytes: 0 } },
        {
          id: 'kafka',
          sim: {
            role: 'kafka',
            hardwareProfile: 'm6i.xlarge',
            partitions: 12,
            replicationFactor: 1,
            tlsEnabled: false,
            compression: 'none',
            retentionBytes: 500_000_000_000,
          },
        },
      ],
      edges: [{ id: 'p-k', source: 'producer', target: 'kafka' }],
    }
    expect(() => simulation.loadTopology(invalidTopology)).toThrow('averagePayloadBytes > 0')
  })
})

describe('Kafka formula descriptors', () => {
  it('emits descriptor payload with non-empty sources and binding formula in each regime', () => {
    const healthy: SimTopology = {
      nodes: [
        { id: 'producer', sim: { role: 'producer', messageRatePerSec: 2_000, averagePayloadBytes: 1_000 } },
        {
          id: 'kafka',
          sim: {
            role: 'kafka',
            hardwareProfile: 'm6i.xlarge',
            partitions: 12,
            replicationFactor: 1,
            tlsEnabled: false,
            compression: 'none',
            retentionBytes: 500_000_000_000,
          },
        },
        { id: 'consumer', sim: { role: 'consumer', consumeRatePerSec: 2_000 } },
      ],
      edges: [
        { id: 'p-k', source: 'producer', target: 'kafka' },
        { id: 'k-c', source: 'kafka', target: 'consumer' },
      ],
    }

    const saturated: SimTopology = {
      ...healthy,
      nodes: [
        { id: 'producer', sim: { role: 'producer', messageRatePerSec: 2_400_000, averagePayloadBytes: 1_000 } },
        {
          id: 'kafka',
          sim: {
            role: 'kafka',
            hardwareProfile: 'm6i.4xlarge',
            partitions: 12,
            replicationFactor: 1,
            tlsEnabled: false,
            compression: 'none',
            retentionBytes: 500_000_000_000,
          },
        },
        { id: 'consumer', sim: { role: 'consumer', consumeRatePerSec: 2_400_000 } },
      ],
    }

    const cliff: SimTopology = {
      ...healthy,
      nodes: [
        { id: 'producer', sim: { role: 'producer', messageRatePerSec: 350_000, averagePayloadBytes: 1_000 } },
        {
          id: 'kafka',
          sim: {
            role: 'kafka',
            hardwareProfile: 'm6i.xlarge',
            partitions: 12,
            replicationFactor: 1,
            tlsEnabled: false,
            compression: 'none',
            retentionBytes: 500_000_000_000,
          },
        },
        { id: 'consumer', sim: { role: 'consumer', consumeRatePerSec: 200_000 } },
      ],
    }

    const healthyWindow = runKafkaTopology(healthy, 2_000)
    const saturatedWindow = runKafkaTopology(saturated, 2_000)
    const cliffWindow = runKafkaTopology(cliff, 120_000)

    for (const window of [healthyWindow, saturatedWindow, cliffWindow]) {
      const descriptors = window.nodes.kafka.formulaDescriptors
      expect(descriptors).toBeDefined()
      expect(descriptors!.length).toBeGreaterThan(0)
      for (const descriptor of descriptors!) {
        expect(descriptor.sources.length).toBeGreaterThan(0)
      }
      if (window.nodes.kafka.kafka?.status !== 'healthy') {
        expect(descriptors!.some((descriptor) => descriptor.isBinding)).toBe(true)
      }
    }
  })
})
