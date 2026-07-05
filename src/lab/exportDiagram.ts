import type { Edge, Node } from '@xyflow/react'
import { HEAT_VARIANTS, type HeatVariant } from './heatVariants'
import { LEGACY_SOURCE_SIDE, LEGACY_TARGET_SIDE, resolveHandleSide } from './handleSides'
import { resolveDirection, resolveThickness } from './edgeStyle'
import { resolveTextSize } from './textSizes'
import type { SimRole } from '../engine/ports'

// A node's simulation role (FR-001) is the only new field this feature
// adds to the canonical node shape. Absent (undefined) for every node
// nobody has assigned a role to, so pre-008 diagrams — and this feature's
// own placeholder/dim/active nodes — round-trip byte-identical to before
// (legacy-diagram parity, US3). Invalid/malformed input silently drops the
// role rather than throwing, matching the tolerance already applied to
// edge variant/thickness/direction and image aspect below.
function plainSimRole(value: unknown): SimRole | undefined {
  if (!isRecord(value)) return undefined
  if (value.role === 'generator' && typeof value.ratePerSec === 'number' && Number.isFinite(value.ratePerSec) && value.ratePerSec >= 0) {
    return { role: 'generator', ratePerSec: value.ratePerSec }
  }
  if (
    value.role === 'processor' &&
    typeof value.serviceRatePerSec === 'number' &&
    Number.isFinite(value.serviceRatePerSec) &&
    value.serviceRatePerSec > 0
  ) {
    return { role: 'processor', serviceRatePerSec: value.serviceRatePerSec }
  }
  if (value.role === 'sink') {
    return { role: 'sink' }
  }
  return undefined
}

// The canonical edge `data` is exactly these three fields. Both the
// serializer and the parser build `data` through this whitelist, so
// editor-runtime fields injected into rendered edges (primaryColor, toolbar
// callbacks — App.tsx) can never leak into the JSON, and every recognized
// value is emitted explicitly on export (contracts/edge-style.md guarantees
// 4 and 5).
function plainEdgeData(data: unknown) {
  const record = isRecord(data) ? data : {}
  const variant: HeatVariant = HEAT_VARIANTS.includes(record.variant as HeatVariant)
    ? (record.variant as HeatVariant)
    : 'default'
  return {
    variant,
    thickness: resolveThickness(record.thickness),
    direction: resolveDirection(record.direction),
  }
}

// Strips React Flow's internal/runtime fields down to the canonical shape
// (specs/001-export-suite/data-model.md). Shared by the JSON export, the
// component export, and the bundle so `diagram.json` is byte-identical no
// matter which export target produced it (single generator, no forks).
export function toPlainDiagram(nodes: Node[], edges: Edge[]) {
  const plainNodes = nodes.map((node) => {
    const imageAspect = typeof node.data.imageAspect === 'number' && Number.isFinite(node.data.imageAspect) && node.data.imageAspect > 0
      ? node.data.imageAspect
      : undefined
    return {
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        label: node.data.label,
        image: node.data.image,
        labelSize: resolveTextSize(node.data.labelSize),
        // Only carried alongside an image — undefined here drops the key
        // via JSON.stringify, keeping legacy/no-image nodes byte-identical
        // to pre-005 output (contracts/image-fit.md guarantee 3).
        imageAspect: node.data.image ? imageAspect : undefined,
        sim: plainSimRole(node.data.sim),
      },
      className: node.className,
      // Present only once the user has manually resized the node
      // (NodeResizer in LabelNode.tsx) or an image fit set it
      // (useDiagramMutations.ts's setNodeImage) — undefined otherwise, so
      // JSON.stringify drops it and untouched nodes keep the auto-sizing
      // behavior on re-import.
      width: node.width,
      height: node.height,
    }
  })

  const plainEdges = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    data: plainEdgeData(edge.data),
    // Always written explicitly (even for edges still holding the legacy
    // right/left default), so a re-export of an imported pre-002 diagram
    // upgrades it to explicit sides rather than staying implicit (FR-004,
    // spec US4 scenario 2).
    sourceHandle: resolveHandleSide(edge.sourceHandle, LEGACY_SOURCE_SIDE),
    targetHandle: resolveHandleSide(edge.targetHandle, LEGACY_TARGET_SIDE),
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
  // imageAspect is dropped (not just left undefined) unless it's a finite,
  // positive number carried alongside a present image — a value without an
  // image, or an invalid one, is meaningless and never throws (FR-008,
  // contracts/image-fit.md guarantee 3).
  const rawImageAspect = value.data.imageAspect
  const imageAspect =
    image && typeof rawImageAspect === 'number' && Number.isFinite(rawImageAspect) && rawImageAspect > 0
      ? rawImageAspect
      : undefined
  const sim = plainSimRole(value.data.sim)
  const node: Node = {
    id: value.id,
    type: typeof value.type === 'string' ? value.type : 'labelNode',
    position: { x: value.position.x, y: value.position.y },
    data: { label: value.data.label, image, labelSize: resolveTextSize(value.data.labelSize), imageAspect, sim },
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
  // Each endpoint falls back to its own legacy default independently — an
  // edge with a valid sourceHandle but an unrecognized targetHandle keeps
  // its valid side and only the bad endpoint is replaced (FR-008, contracts/
  // edge-attachments.md guarantee 3). plainEdgeData applies the same
  // per-field tolerance to variant/thickness/direction.
  return {
    id: value.id,
    source: value.source,
    target: value.target,
    type: typeof value.type === 'string' ? value.type : 'heat',
    data: plainEdgeData(value.data),
    sourceHandle: resolveHandleSide(value.sourceHandle, LEGACY_SOURCE_SIDE),
    targetHandle: resolveHandleSide(value.targetHandle, LEGACY_TARGET_SIDE),
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


