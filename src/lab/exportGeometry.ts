import { getBezierPath, Position, type Edge, type Node } from '@xyflow/react'
import type { HeatVariant } from './heatVariants'

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

// Right-center -> left-center handles, matching LabelNode.tsx (Handle
// type="source" at Position.Right, type="target" at Position.Left).
export function computeEdgePaths(edges: Edge[], boxes: Map<string, NodeBox>): EdgePath[] {
  return edges.flatMap((edge) => {
    const source = boxes.get(edge.source)
    const target = boxes.get(edge.target)
    if (!source || !target) return []
    const [d] = getBezierPath({
      sourceX: source.x + source.width,
      sourceY: source.y + source.height / 2,
      sourcePosition: Position.Right,
      targetX: target.x,
      targetY: target.y + target.height / 2,
      targetPosition: Position.Left,
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
