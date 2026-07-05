import { describe, expect, it } from 'vitest'
import { parseDiagram, serializeDiagram, toPlainDiagram } from '../../src/lab/exportDiagram'
import { kitchenSinkEdges, kitchenSinkNodes } from './fixtures/kitchenSink'
import { HOSTILE_LABEL, hostileLabelNode } from './fixtures/hostileLabel'

describe('parseDiagram', () => {
  it('round-trips a serialized diagram back into React Flow nodes/edges', () => {
    const json = serializeDiagram(kitchenSinkNodes, kitchenSinkEdges)
    const { nodes, edges } = parseDiagram(json)
    expect(nodes).toEqual(toPlainDiagram(kitchenSinkNodes, kitchenSinkEdges).nodes)
    expect(edges).toEqual(toPlainDiagram(kitchenSinkNodes, kitchenSinkEdges).edges)
  })

  it('round-trips a hostile label without corruption', () => {
    const nodes = [hostileLabelNode(kitchenSinkNodes[0])]
    const json = serializeDiagram(nodes, [])
    const { nodes: parsedNodes } = parseDiagram(json)
    expect(parsedNodes[0].data.label).toBe(HOSTILE_LABEL)
  })

  it('drops width/height on untouched nodes so they keep auto-sizing', () => {
    const json = serializeDiagram(kitchenSinkNodes, kitchenSinkEdges)
    const { nodes } = parseDiagram(json)
    const untouched = nodes.find((node) => node.id === 'default-node')
    expect(untouched?.width).toBeUndefined()
    expect(untouched?.height).toBeUndefined()
  })

  it('restores a manually resized node', () => {
    const json = serializeDiagram(kitchenSinkNodes, kitchenSinkEdges)
    const { nodes } = parseDiagram(json)
    const resized = nodes.find((node) => node.id === 'resized-node')
    expect(resized?.width).toBe(220)
    expect(resized?.height).toBe(96)
  })

  it('throws a descriptive error on invalid JSON', () => {
    expect(() => parseDiagram('not json')).toThrow('not valid JSON')
  })

  it('throws a descriptive error when nodes/edges are missing', () => {
    expect(() => parseDiagram('{}')).toThrow('"nodes" and "edges" arrays')
  })

  it('throws a descriptive error when a node is missing required fields', () => {
    expect(() => parseDiagram(JSON.stringify({ nodes: [{ id: 'a' }], edges: [] }))).toThrow('position')
  })

  it('falls back to a default edge variant when the variant is missing or unrecognized', () => {
    const json = JSON.stringify({
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'a' } }],
      edges: [{ id: 'e1', source: 'a', target: 'a', data: { variant: 'not-a-real-variant' } }],
    })
    const { edges } = parseDiagram(json)
    expect(edges[0].data?.variant).toBe('default')
  })
})
