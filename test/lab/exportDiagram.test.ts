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

  it('round-trips labelSize for all three steps', () => {
    const json = serializeDiagram(kitchenSinkNodes, kitchenSinkEdges)
    const { nodes } = parseDiagram(json)
    expect(nodes.find((node) => node.id === 'active-node')?.data.labelSize).toBe('large')
    expect(nodes.find((node) => node.id === 'dim-node')?.data.labelSize).toBe('small')
    expect(nodes.find((node) => node.id === 'default-node')?.data.labelSize).toBe('normal')
  })

  it('parses a legacy node with no labelSize as normal', () => {
    const json = JSON.stringify({
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'a' } }],
      edges: [],
    })
    const { nodes } = parseDiagram(json)
    expect(nodes[0].data.labelSize).toBe('normal')
  })

  it('falls back to normal for an unrecognized labelSize without affecting the rest of the node', () => {
    const json = JSON.stringify({
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'a', labelSize: 'huge' } }],
      edges: [],
    })
    const { nodes } = parseDiagram(json)
    expect(nodes[0].data.labelSize).toBe('normal')
    expect(nodes[0].data.label).toBe('a')
  })

  it('emits an explicit labelSize on every node after re-export', () => {
    const json = JSON.stringify({
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'a' } }],
      edges: [],
    })
    const { nodes } = parseDiagram(json)
    const reexported = JSON.parse(serializeDiagram(nodes, []))
    expect(reexported.nodes[0].data.labelSize).toBe('normal')
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

  it('round-trips imageAspect alongside width/height for a fitted image node', () => {
    const json = JSON.stringify({
      nodes: [
        {
          id: 'a',
          position: { x: 0, y: 0 },
          data: { label: 'a', image: 'data:image/png;base64,AAAA', imageAspect: 2 },
          width: 200,
          height: 120,
        },
      ],
      edges: [],
    })
    const { nodes } = parseDiagram(json)
    expect(nodes[0].data.imageAspect).toBe(2)
    expect(nodes[0].width).toBe(200)
    expect(nodes[0].height).toBe(120)
    const reexported = JSON.parse(serializeDiagram(nodes, []))
    expect(reexported.nodes[0].data.imageAspect).toBe(2)
    expect(reexported.nodes[0].width).toBe(200)
    expect(reexported.nodes[0].height).toBe(120)
  })

  it('imports a legacy image node with no imageAspect unchanged', () => {
    const json = serializeDiagram(kitchenSinkNodes, kitchenSinkEdges)
    const { nodes } = parseDiagram(json)
    const legacyImage = nodes.find((node) => node.id === 'image-node')
    expect(legacyImage?.data.imageAspect).toBeUndefined()
    expect(legacyImage?.data.image).toBeDefined()
  })

  it('drops a non-numeric, non-finite, or non-positive imageAspect without affecting the rest of the node', () => {
    for (const badValue of ['2', Infinity, -1, 0, NaN]) {
      const json = JSON.stringify({
        nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'a', image: 'data:image/png;base64,AAAA', imageAspect: badValue } }],
        edges: [],
      })
      const { nodes } = parseDiagram(json)
      expect(nodes[0].data.imageAspect).toBeUndefined()
      expect(nodes[0].data.label).toBe('a')
      expect(nodes[0].data.image).toBe('data:image/png;base64,AAAA')
    }
  })

  it('drops imageAspect present without data.image', () => {
    const json = JSON.stringify({
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'a', imageAspect: 2 } }],
      edges: [],
    })
    const { nodes } = parseDiagram(json)
    expect(nodes[0].data.imageAspect).toBeUndefined()
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

  it('round-trips edge thickness and direction', () => {
    const nodes = [kitchenSinkNodes[0], kitchenSinkNodes[1]]
    const edges = [
      { id: 'e1', source: 'default-node', target: 'active-node', type: 'heat', data: { variant: 'heat-flow', thickness: 'thick', direction: 'reverse' } },
      { id: 'e2', source: 'default-node', target: 'active-node', type: 'heat', data: { variant: 'default', thickness: 'thin', direction: 'forward' } },
    ]
    const json = serializeDiagram(nodes, edges)
    const { edges: parsedEdges } = parseDiagram(json)
    expect(parsedEdges.map((edge) => [edge.data?.thickness, edge.data?.direction])).toEqual([
      ['thick', 'reverse'],
      ['thin', 'forward'],
    ])
  })

  it('defaults thickness/direction on a pre-003 edge and falls back per-field on unknown values', () => {
    const json = JSON.stringify({
      nodes: [
        { id: 'a', position: { x: 0, y: 0 }, data: { label: 'a' } },
        { id: 'b', position: { x: 100, y: 0 }, data: { label: 'b' } },
      ],
      edges: [
        { id: 'legacy', source: 'a', target: 'b', data: { variant: 'dashed' } },
        { id: 'hand-edited', source: 'a', target: 'b', data: { variant: 'heat-flow', thickness: 'chunky', direction: 'reverse' } },
      ],
    })
    const { edges } = parseDiagram(json)
    expect(edges[0].data).toEqual({ variant: 'dashed', thickness: 'normal', direction: 'forward' })
    // Only the bad field falls back; the valid direction is kept.
    expect(edges[1].data).toEqual({ variant: 'heat-flow', thickness: 'normal', direction: 'reverse' })
  })

  it('strips editor-runtime fields from edge data so they never reach the JSON', () => {
    const nodes = [kitchenSinkNodes[0], kitchenSinkNodes[1]]
    const edges = [
      {
        id: 'e1',
        source: 'default-node',
        target: 'active-node',
        type: 'heat',
        data: { variant: 'heat-flow', thickness: 'thick', direction: 'forward', primaryColor: '#ff4715', onCycleThickness: () => {} },
      },
    ]
    const serialized = JSON.parse(serializeDiagram(nodes, edges)) as { edges: Array<{ data: Record<string, unknown> }> }
    expect(serialized.edges[0].data).toEqual({ variant: 'heat-flow', thickness: 'thick', direction: 'forward' })
  })

  it('emits explicit thickness/direction when re-exporting an imported legacy diagram', () => {
    const json = JSON.stringify({
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'a' } }],
      edges: [{ id: 'e1', source: 'a', target: 'a', data: { variant: 'default' } }],
    })
    const { nodes, edges } = parseDiagram(json)
    const reExported = JSON.parse(serializeDiagram(nodes, edges)) as { edges: Array<{ data: Record<string, unknown> }> }
    expect(reExported.edges[0].data.thickness).toBe('normal')
    expect(reExported.edges[0].data.direction).toBe('forward')
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
