import { describe, expect, it } from 'vitest'
import { createSimulation } from '../../src/engine/simulation'
import { mulberry32, PoissonTrafficSource } from '../../src/engine/poisson'
import type { MetricsSinkPort, MetricsWindow, SimTopology } from '../../src/engine/ports'
import { CycleError } from '../../src/engine/ports'

function collectingSink(): { sink: MetricsSinkPort; windows: MetricsWindow[] } {
  const windows: MetricsWindow[] = []
  return { sink: { emitWindow: (window) => windows.push(window) }, windows }
}

const uncongestedTopology: SimTopology = {
  nodes: [
    { id: 'gen', sim: { role: 'generator', ratePerSec: 100 } },
    { id: 'proc', sim: { role: 'processor', serviceRatePerSec: 200 } },
    { id: 'sink', sim: { role: 'sink' } },
  ],
  edges: [
    { id: 'gen-proc', source: 'gen', target: 'proc' },
    { id: 'proc-sink', source: 'proc', target: 'sink' },
  ],
}

const congestedTopology: SimTopology = {
  ...uncongestedTopology,
  nodes: [
    { id: 'gen', sim: { role: 'generator', ratePerSec: 300 } },
    { id: 'proc', sim: { role: 'processor', serviceRatePerSec: 200 } },
    { id: 'sink', sim: { role: 'sink' } },
  ],
}

describe('createSimulation lifecycle', () => {
  it('emits no windows while idle or paused', () => {
    const { sink, windows } = collectingSink()
    const simulation = createSimulation(new PoissonTrafficSource(mulberry32(1)), sink, 200)
    simulation.loadTopology(uncongestedTopology)
    simulation.tick(200)
    expect(windows).toHaveLength(0)

    simulation.start()
    simulation.pause()
    simulation.tick(200)
    expect(windows).toHaveLength(0)
  })

  it('emits exactly one window per windowSizeMs of elapsed running time', () => {
    const { sink, windows } = collectingSink()
    const simulation = createSimulation(new PoissonTrafficSource(mulberry32(1)), sink, 200)
    simulation.loadTopology(uncongestedTopology)
    simulation.start()
    simulation.tick(1000)
    expect(windows).toHaveLength(5)
  })

  it('rejects a cyclic topology at loadTopology', () => {
    const { sink } = collectingSink()
    const simulation = createSimulation(new PoissonTrafficSource(mulberry32(1)), sink, 200)
    const cyclic: SimTopology = {
      nodes: [
        { id: 'a', sim: { role: 'processor', serviceRatePerSec: 100 } },
        { id: 'b', sim: { role: 'processor', serviceRatePerSec: 100 } },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
      ],
    }
    expect(() => simulation.loadTopology(cyclic)).toThrow(CycleError)
  })

  it('runs with no generator without throwing, reporting zero throughput everywhere', () => {
    const { sink, windows } = collectingSink()
    const simulation = createSimulation(new PoissonTrafficSource(mulberry32(1)), sink, 200)
    simulation.loadTopology({
      nodes: [
        { id: 'proc', sim: { role: 'processor', serviceRatePerSec: 200 } },
        { id: 'sink', sim: { role: 'sink' } },
      ],
      edges: [{ id: 'e1', source: 'proc', target: 'sink' }],
    })
    simulation.start()
    simulation.tick(200)
    expect(windows).toHaveLength(1)
    expect(windows[0].nodes.proc.throughputPerSec).toBe(0)
    expect(windows[0].nodes.proc.queueDepth).toBe(0)
  })

  it('reset zeroes virtual time and metrics', () => {
    const { sink, windows } = collectingSink()
    const simulation = createSimulation(new PoissonTrafficSource(mulberry32(1)), sink, 200)
    simulation.loadTopology(congestedTopology)
    simulation.start()
    simulation.tick(2000)
    expect(windows.at(-1)?.nodes.proc.queueDepth).toBeGreaterThan(0)

    simulation.reset()
    windows.length = 0
    simulation.start()
    simulation.tick(200)
    expect(windows[0].windowEndSimTimeMs).toBe(200)
    // Congestion restarts from an empty backlog, not from wherever it left
    // off before reset — one 200ms window in isn't enough to rebuild the
    // sizeable backlog asserted above.
    expect(windows[0].nodes.proc.queueDepth).toBeLessThan(10)
  })
})

describe('createSimulation steady-state throughput (SC-003)', () => {
  it('an uncongested processor (rate < serviceRate) reports throughput near the input rate with ~zero queue', () => {
    const { sink, windows } = collectingSink()
    const simulation = createSimulation(new PoissonTrafficSource(mulberry32(2)), sink, 200)
    simulation.loadTopology(uncongestedTopology)
    simulation.start()
    simulation.tick(10_000)
    const last = windows.at(-1)
    expect(last).toBeDefined()
    const throughput = last!.nodes.proc.throughputPerSec
    expect(throughput).toBeGreaterThan(90)
    expect(throughput).toBeLessThan(110)
    expect(last!.nodes.proc.queueDepth).toBeLessThan(5)
  })

  it('a congested processor (rate > serviceRate) plateaus near the service rate and its queue grows', () => {
    const { sink, windows } = collectingSink()
    const simulation = createSimulation(new PoissonTrafficSource(mulberry32(3)), sink, 200)
    simulation.loadTopology(congestedTopology)
    simulation.start()
    simulation.tick(10_000)
    const last = windows.at(-1)
    expect(last).toBeDefined()
    const throughput = last!.nodes.proc.throughputPerSec
    expect(throughput).toBeGreaterThan(190)
    expect(throughput).toBeLessThan(210)
    expect(last!.nodes.proc.queueDepth).toBeGreaterThan(50)
  })

  it('the generator -> processor edge carries the input rate and the processor -> sink edge carries the served rate', () => {
    const { sink, windows } = collectingSink()
    const simulation = createSimulation(new PoissonTrafficSource(mulberry32(4)), sink, 200)
    simulation.loadTopology(congestedTopology)
    simulation.start()
    simulation.tick(10_000)
    const last = windows.at(-1)
    expect(last).toBeDefined()
    expect(last!.edges['gen-proc'].throughputPerSec).toBeGreaterThan(280)
    expect(last!.edges['proc-sink'].throughputPerSec).toBeLessThan(220)
  })
})
