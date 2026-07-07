import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDiagram, serializeDiagram, toPlainDiagram } from '../../src/lab/exportDiagram'
import { kitchenSinkEdges, kitchenSinkNodes } from './fixtures/kitchenSink'
import { HOSTILE_LABEL, hostileLabelNode } from './fixtures/hostileLabel'

const legacyDiagramJson = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'legacy-diagram.json'),
  'utf-8',
)

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

  // --- Simulation config (011-host-queue-model) ---

  it('round-trips client_pool/external_api hosts and a queue', () => {
    const nodes = [
      {
        id: 'pool',
        type: 'labelNode',
        position: { x: 0, y: 0 },
        data: { label: 'pool', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 100 } },
      },
      {
        id: 'ext',
        type: 'labelNode',
        position: { x: 100, y: 0 },
        data: { label: 'ext', sim: { kind: 'host', profile: 'external_api', manualBaselineLatencyMs: 40 } },
      },
      { id: 'q', type: 'labelNode', position: { x: 200, y: 0 }, data: { label: 'q', sim: { kind: 'queue' } } },
    ]
    const json = serializeDiagram(nodes, [])
    const { nodes: parsedNodes } = parseDiagram(json)
    expect(parsedNodes.find((node) => node.id === 'pool')?.data.sim).toEqual({
      kind: 'host',
      profile: 'client_pool',
      requestRatePerSec: 100,
    })
    expect(parsedNodes.find((node) => node.id === 'ext')?.data.sim).toEqual({
      kind: 'host',
      profile: 'external_api',
      manualBaselineLatencyMs: 40,
    })
    expect(parsedNodes.find((node) => node.id === 'q')?.data.sim).toEqual({ kind: 'queue' })
  })

  it('round-trips a manual-mode and a calculated-mode compute host', () => {
    const nodes = [
      {
        id: 'manual',
        type: 'labelNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'manual',
          sim: {
            kind: 'host',
            profile: 'transactional_api',
            configMode: 'manual',
            manualBaselineLatencyMs: 10,
            manualSaturationRPS: 500,
            manualMaxRPS: 600,
            minReplicas: 1,
            maxReplicas: 3,
            bootDelayMs: 8000,
            highWatermark: 0.8,
            lowWatermark: 0.3,
          },
        },
      },
      {
        id: 'calculated',
        type: 'labelNode',
        position: { x: 100, y: 0 },
        data: {
          label: 'calculated',
          sim: {
            kind: 'host',
            profile: 'database_server',
            configMode: 'calculated',
            cpuProcessingTimeMs: 16,
            maxWorkerThreads: 8,
            minReplicas: 2,
            maxReplicas: 2,
            bootDelayMs: 8000,
            highWatermark: 0.8,
            lowWatermark: 0.3,
          },
        },
      },
    ]
    const json = serializeDiagram(nodes, [])
    const { nodes: parsedNodes } = parseDiagram(json)
    expect(parsedNodes.find((node) => node.id === 'manual')?.data.sim).toEqual({
      kind: 'host',
      profile: 'transactional_api',
      configMode: 'manual',
      manualBaselineLatencyMs: 10,
      manualSaturationRPS: 500,
      manualMaxRPS: 600,
      minReplicas: 1,
      maxReplicas: 3,
      bootDelayMs: 8000,
      highWatermark: 0.8,
      lowWatermark: 0.3,
    })
    expect(parsedNodes.find((node) => node.id === 'calculated')?.data.sim).toEqual({
      kind: 'host',
      profile: 'database_server',
      configMode: 'calculated',
      cpuProcessingTimeMs: 16,
      maxWorkerThreads: 8,
      minReplicas: 2,
      maxReplicas: 2,
      bootDelayMs: 8000,
      highWatermark: 0.8,
      lowWatermark: 0.3,
    })
  })

  it('imports a pre-013 host (no minReplicas/maxReplicas fields at all) as minReplicas = maxReplicas = 1 (research.md D5/FR-013)', () => {
    const pre013Json = JSON.stringify({
      nodes: [
        {
          id: 'legacy-api',
          type: 'labelNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'legacy api',
            sim: {
              kind: 'host',
              profile: 'transactional_api',
              configMode: 'manual',
              manualBaselineLatencyMs: 10,
              manualSaturationRPS: 500,
              manualMaxRPS: 600,
            },
          },
        },
      ],
      edges: [],
    })
    const { nodes: parsedNodes } = parseDiagram(pre013Json)
    expect(parsedNodes[0].data.sim).toEqual({
      kind: 'host',
      profile: 'transactional_api',
      configMode: 'manual',
      manualBaselineLatencyMs: 10,
      manualSaturationRPS: 500,
      manualMaxRPS: 600,
      minReplicas: 1,
      maxReplicas: 1,
      bootDelayMs: 8000,
      highWatermark: 0.8,
      lowWatermark: 0.3,
    })
  })

  it('imports a pre-3.2.0 host (minReplicas/maxReplicas present, no bootDelayMs) with the legacy boot delay filled in (constitution v3.2.0)', () => {
    const pre320Json = JSON.stringify({
      nodes: [
        {
          id: 'scaled-api',
          type: 'labelNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'scaled api',
            sim: {
              kind: 'host',
              profile: 'transactional_api',
              configMode: 'manual',
              manualBaselineLatencyMs: 10,
              manualSaturationRPS: 500,
              manualMaxRPS: 600,
              minReplicas: 1,
              maxReplicas: 4,
            },
          },
        },
      ],
      edges: [],
    })
    const { nodes: parsedNodes } = parseDiagram(pre320Json)
    expect(parsedNodes[0].data.sim).toEqual({
      kind: 'host',
      profile: 'transactional_api',
      configMode: 'manual',
      manualBaselineLatencyMs: 10,
      manualSaturationRPS: 500,
      manualMaxRPS: 600,
      minReplicas: 1,
      maxReplicas: 4,
      bootDelayMs: 8000,
      highWatermark: 0.8,
      lowWatermark: 0.3,
    })
  })

  it('imports a pre-3.3.0 host (minReplicas/maxReplicas/bootDelayMs present, no watermarks) with the legacy watermarks filled in (constitution v3.3.0)', () => {
    const pre330Json = JSON.stringify({
      nodes: [
        {
          id: 'scaled-api',
          type: 'labelNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'scaled api',
            sim: {
              kind: 'host',
              profile: 'transactional_api',
              configMode: 'manual',
              manualBaselineLatencyMs: 10,
              manualSaturationRPS: 500,
              manualMaxRPS: 600,
              minReplicas: 1,
              maxReplicas: 4,
              bootDelayMs: 3000,
            },
          },
        },
      ],
      edges: [],
    })
    const { nodes: parsedNodes } = parseDiagram(pre330Json)
    expect(parsedNodes[0].data.sim).toEqual({
      kind: 'host',
      profile: 'transactional_api',
      configMode: 'manual',
      manualBaselineLatencyMs: 10,
      manualSaturationRPS: 500,
      manualMaxRPS: 600,
      minReplicas: 1,
      maxReplicas: 4,
      bootDelayMs: 3000,
      highWatermark: 0.8,
      lowWatermark: 0.3,
    })
  })

  it('round-trips an edge simConfig', () => {
    const nodes = [kitchenSinkNodes[0], kitchenSinkNodes[1]]
    const edges = [
      {
        id: 'e1',
        source: 'default-node',
        target: 'active-node',
        type: 'heat',
        data: {
          variant: 'default',
          simConfig: { trafficShareRatio: 0.5, averagePayloadSizeKB: 12, targetComputeWeightMultiplier: 1.2, pathIoLatencyMs: 5 },
        },
      },
    ]
    const json = serializeDiagram(nodes, edges)
    const { edges: parsedEdges } = parseDiagram(json)
    expect(parsedEdges[0].data?.simConfig).toEqual({
      trafficShareRatio: 0.5,
      averagePayloadSizeKB: 12,
      targetComputeWeightMultiplier: 1.2,
      pathIoLatencyMs: 5,
    })
  })

  it('degrades a retired-role node (generator/processor/producer/consumer/sink/kafka) to a plain visual node on import', () => {
    const json = JSON.stringify({
      nodes: [
        { id: 'gen', position: { x: 0, y: 0 }, data: { label: 'gen', sim: { role: 'generator', ratePerSec: 100 } } },
        { id: 'kafka', position: { x: 100, y: 0 }, data: { label: 'kafka', sim: { role: 'kafka', hardwareProfile: 'm6i.large' } } },
      ],
      edges: [],
    })
    const { nodes } = parseDiagram(json)
    expect(nodes.every((node) => node.data.sim === undefined)).toBe(true)
    expect(nodes.map((node) => node.data.label)).toEqual(['gen', 'kafka'])
  })

  it('omits data.sim entirely for a node with no simulation role', () => {
    const json = JSON.parse(serializeDiagram(kitchenSinkNodes, kitchenSinkEdges)) as { nodes: Array<{ data: Record<string, unknown> }> }
    for (const node of json.nodes) {
      expect('sim' in node.data).toBe(false)
    }
  })

  it('never serializes a node\'s transient simMetrics', () => {
    const nodes = [
      {
        id: 'gen',
        type: 'labelNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'gen',
          sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 100 },
          simMetrics: { throughputPerSec: 100, queueDepth: 0 },
        },
      },
    ]
    const json = JSON.parse(serializeDiagram(nodes, [])) as { nodes: Array<{ data: Record<string, unknown> }> }
    expect('simMetrics' in json.nodes[0].data).toBe(false)
  })

  it('never serializes an edge\'s transient simMetrics', () => {
    const nodes = [kitchenSinkNodes[0], kitchenSinkNodes[1]]
    const edges = [
      {
        id: 'e1',
        source: 'default-node',
        target: 'active-node',
        type: 'heat',
        data: { variant: 'heat-flow', simMetrics: { throughputPerSec: 50 } },
      },
    ]
    const json = JSON.parse(serializeDiagram(nodes, edges)) as { edges: Array<{ data: Record<string, unknown> }> }
    expect('simMetrics' in json.edges[0].data).toBe(false)
  })

  it('drops an invalid sim config (negative rate, unrecognized kind) rather than throwing', () => {
    const json = JSON.stringify({
      nodes: [
        { id: 'a', position: { x: 0, y: 0 }, data: { label: 'a', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: -1 } } },
        { id: 'b', position: { x: 100, y: 0 }, data: { label: 'b', sim: { kind: 'not-a-real-kind' } } },
      ],
      edges: [],
    })
    const { nodes } = parseDiagram(json)
    expect(nodes.every((node) => node.data.sim === undefined)).toBe(true)
  })

  it('imports the pre-008 legacy fixture without error and with no simulation role on any node', () => {
    const { nodes, edges } = parseDiagram(legacyDiagramJson)
    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(2)
    expect(nodes.every((node) => node.data.sim === undefined)).toBe(true)
  })
})
