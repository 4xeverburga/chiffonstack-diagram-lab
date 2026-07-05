import { describe, expect, it } from 'vitest'
import { buildTopologyGraph, detectCycle, drainProcessorBacklog, generatorUsesBatchMode, nextOutgoingEdgeIndex } from '../../src/engine/components'
import type { SimTopology } from '../../src/engine/ports'

const threeNodeTopology: SimTopology = {
  nodes: [
    { id: 'gen', sim: { role: 'generator', ratePerSec: 100 } },
    { id: 'proc', sim: { role: 'processor', serviceRatePerSec: 200 } },
    { id: 'sink', sim: { role: 'sink' } },
  ],
  edges: [
    { id: 'e1', source: 'gen', target: 'proc' },
    { id: 'e2', source: 'proc', target: 'sink' },
  ],
}

describe('buildTopologyGraph', () => {
  it('indexes nodes, edges, and generator ids', () => {
    const graph = buildTopologyGraph(threeNodeTopology)
    expect(graph.nodeIds).toEqual(['gen', 'proc', 'sink'])
    expect(graph.generatorNodeIds).toEqual(['gen'])
    expect(graph.outgoingEdgesByNode.get('gen')).toEqual(['e1'])
    expect(graph.edgeById.get('e1')).toEqual({ source: 'gen', target: 'proc' })
  })
})

describe('detectCycle', () => {
  it('returns undefined for an acyclic topology', () => {
    expect(detectCycle(buildTopologyGraph(threeNodeTopology))).toBeUndefined()
  })

  it('detects a direct two-node cycle', () => {
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
    const cycle = detectCycle(buildTopologyGraph(cyclic))
    expect(cycle).toBeDefined()
    expect(cycle).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('detects a longer cycle through three nodes', () => {
    const cyclic: SimTopology = {
      nodes: [
        { id: 'a', sim: { role: 'processor', serviceRatePerSec: 100 } },
        { id: 'b', sim: { role: 'processor', serviceRatePerSec: 100 } },
        { id: 'c', sim: { role: 'processor', serviceRatePerSec: 100 } },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
        { id: 'e3', source: 'c', target: 'a' },
      ],
    }
    expect(detectCycle(buildTopologyGraph(cyclic))).toBeDefined()
  })

  it('ignores edges reaching a node with no sim role', () => {
    const topology: SimTopology = {
      nodes: [{ id: 'gen', sim: { role: 'generator', ratePerSec: 10 } }],
      edges: [{ id: 'e1', source: 'gen', target: 'plain-node' }],
    }
    expect(detectCycle(buildTopologyGraph(topology))).toBeUndefined()
  })
})

describe('nextOutgoingEdgeIndex', () => {
  it('cycles round-robin through available edges', () => {
    let index = -1
    index = nextOutgoingEdgeIndex(index, 3)
    expect(index).toBe(0)
    index = nextOutgoingEdgeIndex(index, 3)
    expect(index).toBe(1)
    index = nextOutgoingEdgeIndex(index, 3)
    expect(index).toBe(2)
    index = nextOutgoingEdgeIndex(index, 3)
    expect(index).toBe(0)
  })

  it('returns 0 when there are no edges', () => {
    expect(nextOutgoingEdgeIndex(-1, 0)).toBe(0)
  })
})

describe('drainProcessorBacklog', () => {
  it('drains the full backlog when capacity exceeds it', () => {
    const result = drainProcessorBacklog(10, 1000, 1000)
    expect(result.departed).toBe(10)
    expect(result.remainingBacklog).toBe(0)
  })

  it('drains only what capacity allows, leaving the remainder queued', () => {
    // serviceRate 100/s over 100ms => capacity 10.
    const result = drainProcessorBacklog(50, 100, 100)
    expect(result.departed).toBeCloseTo(10)
    expect(result.remainingBacklog).toBeCloseTo(40)
  })

  it('is a no-op on an empty backlog', () => {
    const result = drainProcessorBacklog(0, 500, 200)
    expect(result.departed).toBe(0)
    expect(result.remainingBacklog).toBe(0)
  })
})

describe('generatorUsesBatchMode', () => {
  it('stays per-item below the threshold', () => {
    expect(generatorUsesBatchMode(100)).toBe(false)
  })

  it('switches to batch mode above the threshold', () => {
    expect(generatorUsesBatchMode(1_000_000)).toBe(true)
  })
})
