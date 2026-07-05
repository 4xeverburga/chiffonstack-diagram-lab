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

  it('round-trips explicit side attachments across several distinct combinations', () => {
    const nodes = [kitchenSinkNodes[0], kitchenSinkNodes[1]]
    const edges = [
      { id: 'e1', source: 'default-node', target: 'active-node', type: 'heat', data: { variant: 'default' }, sourceHandle: 'left', targetHandle: 'top' },
      { id: 'e2', source: 'default-node', target: 'active-node', type: 'heat', data: { variant: 'default' }, sourceHandle: 'bottom', targetHandle: 'right' },
      { id: 'e3', source: 'default-node', target: 'active-node', type: 'heat', data: { variant: 'default' }, sourceHandle: 'top', targetHandle: 'bottom' },
    ]
    const json = serializeDiagram(nodes, edges)
    const { edges: parsedEdges } = parseDiagram(json)
    expect(parsedEdges.map((edge) => [edge.sourceHandle, edge.targetHandle])).toEqual([
      ['left', 'top'],
      ['bottom', 'right'],
      ['top', 'bottom'],
    ])
  })

  it('falls back each endpoint to its own legacy default independently on an unrecognized value', () => {
    const json = JSON.stringify({
      nodes: [
        { id: 'a', position: { x: 0, y: 0 }, data: { label: 'a' } },
        { id: 'b', position: { x: 100, y: 0 }, data: { label: 'b' } },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', sourceHandle: 'top', targetHandle: 'north' }],
    })
    const { edges } = parseDiagram(json)
    expect(edges[0].sourceHandle).toBe('top')
    expect(edges[0].targetHandle).toBe('left')
  })

  it('assigns the legacy right/left sides to a pre-feature edge with no handle fields', () => {
    const json = JSON.stringify({
      nodes: [
        { id: 'a', position: { x: 0, y: 0 }, data: { label: 'a' } },
        { id: 'b', position: { x: 100, y: 0 }, data: { label: 'b' } },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', type: 'heat', data: { variant: 'default' } }],
    })
    const { nodes, edges } = parseDiagram(json)
    expect(edges[0].sourceHandle).toBe('right')
    expect(edges[0].targetHandle).toBe('left')

    // Re-exporting the imported (in-memory) diagram now carries explicit
    // sides, upgrading the legacy file instead of silently staying implicit
    // (FR-004, spec US4 scenario 2).
    const reExported = JSON.parse(serializeDiagram(nodes, edges)) as { edges: Array<Record<string, unknown>> }
    expect(reExported.edges[0].sourceHandle).toBe('right')
    expect(reExported.edges[0].targetHandle).toBe('left')
  })
})
