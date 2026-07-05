import { getBezierPath, type Edge, type Node } from '@xyflow/react'
import type { HeatVariant } from './heatVariants'
import { anchorPointForSide, HANDLE_SIDE_POSITION, LEGACY_SOURCE_SIDE, LEGACY_TARGET_SIDE, resolveHandleSide } from './handleSides'

// Shared node sizing + edge path math used by every visual export target
// (component code, animated SVG) so they can't drift apart from each other
// or from the canvas. Sizing heuristic and margin match the canvas's default
// node dimensions; edge paths reuse React Flow's own bezier function so the
// exported curves are identical to what HeatEdge.tsx draws.
const NODE_HEIGHT = 40
const CHAR_WIDTH = 7.5
const NODE_PADDING_X = 28
const ICON_SIZE = 28
const ICON_GAP = 6
export const CANVAS_MARGIN = 32

export type NodeBox = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export type EdgePath = {
  id: string
  d: string
  variant: HeatVariant
}

export function nodeLabel(node: Node): string {
  return typeof node.data.label === 'string' ? node.data.label : ''
}

export function nodeImage(node: Node): string | undefined {
  return typeof node.data.image === 'string' ? node.data.image : undefined
}

// Nodes stack their image above the label (like a captioned icon), so an
// image only adds to the node's height, not its width.
function nodeWidth(label: string, hasImage: boolean): number {
  const textWidth = Math.round(label.length * CHAR_WIDTH) + NODE_PADDING_X
  const minWidthForIcon = hasImage ? ICON_SIZE + NODE_PADDING_X : 0
  return Math.max(80, textWidth, minWidthForIcon)
}

function nodeHeight(hasImage: boolean): number {
  return hasImage ? NODE_HEIGHT + ICON_SIZE + ICON_GAP : NODE_HEIGHT
}

// Computes every node's on-canvas box: position normalized so the top-left-
// most node sits at (0, 0), and size honoring a manual resize (NodeResizer
// in LabelNode.tsx) when present, falling back to the same auto-size
// heuristic the canvas uses.
export function computeNodeBoxes(nodes: Node[]): Map<string, NodeBox> {
  const minX = Math.min(...nodes.map((node) => node.position.x))
  const minY = Math.min(...nodes.map((node) => node.position.y))
  return new Map(
    nodes.map((node) => {
      const hasImage = Boolean(nodeImage(node))
      const width = node.width ?? nodeWidth(nodeLabel(node), hasImage)
      const height = node.height ?? nodeHeight(hasImage)
      return [node.id, { id: node.id, x: node.position.x - minX, y: node.position.y - minY, width, height }]
    }),
  )
}

export function edgeVariant(edge: Edge): HeatVariant {
  const variant = (edge.data as { variant?: HeatVariant } | undefined)?.variant
  return variant ?? 'default'
}

// Anchors each edge on the side its data records (sourceHandle/targetHandle,
// defaulting through the legacy right/left pair — same fallback parseDiagram.ts
// applies on import, so an edge that skipped that path, e.g. straight from
// canvas state, anchors identically). Reuses React Flow's own bezier
// function so the exported curve is identical to what HeatEdge.tsx draws
// (FR-005, FR-006, FR-009).
export function computeEdgePaths(edges: Edge[], boxes: Map<string, NodeBox>): EdgePath[] {
  return edges.flatMap((edge) => {
    const source = boxes.get(edge.source)
    const target = boxes.get(edge.target)
    if (!source || !target) return []
    const sourceSide = resolveHandleSide(edge.sourceHandle, LEGACY_SOURCE_SIDE)
    const targetSide = resolveHandleSide(edge.targetHandle, LEGACY_TARGET_SIDE)
    const sourcePoint = anchorPointForSide(source, sourceSide)
    const targetPoint = anchorPointForSide(target, targetSide)
    const [d] = getBezierPath({
      sourceX: sourcePoint.x,
      sourceY: sourcePoint.y,
      sourcePosition: HANDLE_SIDE_POSITION[sourceSide],
      targetX: targetPoint.x,
      targetY: targetPoint.y,
      targetPosition: HANDLE_SIDE_POSITION[targetSide],
    })
    return [{ id: edge.id, d, variant: edgeVariant(edge) }]
  })
}

// Bounding size of the whole diagram (normalized node boxes + a margin),
// used to size the exported SVG's viewBox/width/height.
export function computeContentSize(boxes: Map<string, NodeBox>, margin: number): { width: number; height: number } {
  const boxList = [...boxes.values()]
  const width = Math.round(Math.max(...boxList.map((box) => box.x + box.width))) + margin
  const height = Math.round(Math.max(...boxList.map((box) => box.y + box.height))) + margin
  return { width, height }
}
