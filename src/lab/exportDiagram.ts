import type { Edge, Node } from '@xyflow/react'
import { HEAT_VARIANTS, type HeatVariant } from './heatVariants'

// Strips React Flow's internal/runtime fields down to the canonical shape
// (specs/001-export-suite/data-model.md). Shared by the JSON export, the
// component export, and the bundle so `diagram.json` is byte-identical no
// matter which export target produced it (single generator, no forks).
export function toPlainDiagram(nodes: Node[], edges: Edge[]) {
  const plainNodes = nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: { label: node.data.label, image: node.data.image },
    className: node.className,
    // Present only once the user has manually resized the node (NodeResizer
    // in LabelNode.tsx) — undefined otherwise, so JSON.stringify drops it and
    // untouched nodes keep the auto-sizing behavior on re-import.
    width: node.width,
    height: node.height,
  }))

  const plainEdges = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    data: edge.data,
  }))

  return { nodes: plainNodes, edges: plainEdges }
}

export function serializeDiagram(nodes: Node[], edges: Edge[]): string {
  return JSON.stringify(toPlainDiagram(nodes, edges), null, 2)
}

export function downloadDiagram(nodes: Node[], edges: Edge[]): void {
  const json = serializeDiagram(nodes, edges)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'diagram.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parsePlainNode(value: unknown, index: number): Node {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error(`Diagram Lab: node at index ${index} is missing a string "id".`)
  }
  if (!isRecord(value.position) || typeof value.position.x !== 'number' || typeof value.position.y !== 'number') {
    throw new Error(`Diagram Lab: node "${value.id}" is missing a numeric "position".`)
  }
  if (!isRecord(value.data) || typeof value.data.label !== 'string') {
    throw new Error(`Diagram Lab: node "${value.id}" is missing a string "data.label".`)
  }
  const image = typeof value.data.image === 'string' ? value.data.image : undefined
  const node: Node = {
    id: value.id,
    type: typeof value.type === 'string' ? value.type : 'labelNode',
    position: { x: value.position.x, y: value.position.y },
    data: { label: value.data.label, image },
    className: typeof value.className === 'string' ? value.className : undefined,
  }
  if (typeof value.width === 'number') node.width = value.width
  if (typeof value.height === 'number') node.height = value.height
  return node
}

function parsePlainEdge(value: unknown, index: number): Edge {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error(`Diagram Lab: edge at index ${index} is missing a string "id".`)
  }
  if (typeof value.source !== 'string' || typeof value.target !== 'string') {
    throw new Error(`Diagram Lab: edge "${value.id}" is missing a string "source"/"target".`)
  }
  const rawVariant = isRecord(value.data) ? value.data.variant : undefined
  const variant: HeatVariant = HEAT_VARIANTS.includes(rawVariant as HeatVariant) ? (rawVariant as HeatVariant) : 'default'
  return {
    id: value.id,
    source: value.source,
    target: value.target,
    type: typeof value.type === 'string' ? value.type : 'heat',
    data: { variant },
  }
}

// Inverse of toPlainDiagram: turns an uploaded diagram.json back into React
// Flow's Node/Edge shape (contracts/diagram-json.md round-trip guarantee).
// Throws a descriptive error on malformed input; the UI layer surfaces it.
export function parseDiagram(json: string): { nodes: Node[]; edges: Edge[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Diagram Lab: that file is not valid JSON.')
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error('Diagram Lab: expected an object with "nodes" and "edges" arrays.')
  }
  const nodes = parsed.nodes.map((node, index) => parsePlainNode(node, index))
  const edges = parsed.edges.map((edge, index) => parsePlainEdge(edge, index))
  return { nodes, edges }
}


