import type { Edge, Node } from '@xyflow/react'
import type { DesignTokens } from './designTokens'
import type { HeatVariant } from './heatVariants'
import { kindForClassName } from './nodeKinds'

// Renders the current nodes/edges as a self-contained, static HTML/SVG
// snippet styled with the caller's own design tokens — no React Flow (or any
// JS) runtime required to display it, matching this project's "diagrams ship
// as imagery" philosophy.
const NODE_HEIGHT = 40
const CHAR_WIDTH = 7.5
const NODE_PADDING_X = 28
const CANVAS_MARGIN = 32
const ICON_SIZE = 28
const ICON_GAP = 6

function nodeLabel(node: Node): string {
  return typeof node.data.label === 'string' ? node.data.label : ''
}

function nodeImage(node: Node): string | undefined {
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

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function edgeVariant(edge: Edge): HeatVariant {
  const variant = (edge.data as { variant?: HeatVariant } | undefined)?.variant
  return variant ?? 'default'
}

function edgeStroke(variant: HeatVariant, tokens: DesignTokens): { stroke: string; dashArray?: string } {
  if (variant === 'heat-flow' || variant === 'heat-static') return { stroke: tokens.primaryColor }
  if (variant === 'dashed') return { stroke: tokens.secondaryColor, dashArray: '6 6' }
  return { stroke: tokens.secondaryColor }
}

export function generateDiagramCode(nodes: Node[], edges: Edge[], tokens: DesignTokens): string {
  if (nodes.length === 0) {
    return '<!-- Diagram Lab: add nodes to the canvas before exporting code. -->'
  }

  // A node the user manually resized (NodeResizer, in LabelNode.tsx) carries
  // an explicit width/height — honor that instead of the auto-computed size
  // so the exported code matches what's on the canvas.
  const dims = new Map(
    nodes.map((node) => {
      const hasImage = Boolean(nodeImage(node))
      const width = node.width ?? nodeWidth(nodeLabel(node), hasImage)
      const height = node.height ?? nodeHeight(hasImage)
      return [node.id, { width, height }]
    }),
  )
  const minX = Math.min(...nodes.map((node) => node.position.x))
  const minY = Math.min(...nodes.map((node) => node.position.y))

  const nodeMarkup = nodes
    .map((node) => {
      const kind = kindForClassName(node.className)
      const { width, height } = dims.get(node.id)!
      const x = node.position.x - minX
      const y = node.position.y - minY
      const isActive = kind === 'active'
      const isDim = kind === 'dim'
      const borderColor = isActive ? tokens.primaryColor : tokens.secondaryColor
      const style = [
        'position:absolute',
        `left:${x}px`,
        `top:${y}px`,
        `width:${width}px`,
        `height:${height}px`,
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'justify-content:center',
        'gap:6px',
        `border:1px ${isDim ? 'dashed' : 'solid'} ${borderColor}`,
        'border-radius:8px',
        'box-sizing:border-box',
        'overflow:hidden',
        `font-family:${tokens.bodyFont}`,
        'font-size:13px',
        'text-align:center',
        // Dim nodes are de-emphasized via a dashed border + muted text only —
        // never a blanket opacity, which would also wash out the node's image.
        isDim ? 'color:rgba(0,0,0,0.55)' : '',
        isActive ? `box-shadow:0 0 0 1px ${tokens.primaryColor}66` : '',
      ]
        .filter(Boolean)
        .join('; ')
      const image = nodeImage(node)
      // Matches .node-image in App.css: flex-grow so a manually resized,
      // taller node also renders a bigger, more legible image here.
      const imageTag = image
        ? `<img src="${escapeHtml(image)}" alt="" style="flex:1 1 ${ICON_SIZE}px; min-width:0; min-height:0; width:auto; max-width:100%; object-fit:contain; border-radius:6px; background:#fff; padding:3px; box-shadow:0 0 0 1px rgba(0,0,0,0.12);" />`
        : ''
      return `    <div style="${style}">${imageTag}<span>${escapeHtml(nodeLabel(node))}</span></div>`
    })
    .join('\n')

  const edgeMarkup = edges
    .map((edge) => {
      const source = nodes.find((node) => node.id === edge.source)
      const target = nodes.find((node) => node.id === edge.target)
      if (!source || !target) return ''
      const sourceDim = dims.get(source.id)!
      const targetDim = dims.get(target.id)!
      const x1 = source.position.x - minX + sourceDim.width
      const y1 = source.position.y - minY + sourceDim.height / 2
      const x2 = target.position.x - minX
      const y2 = target.position.y - minY + targetDim.height / 2
      const { stroke, dashArray } = edgeStroke(edgeVariant(edge), tokens)
      const dashAttr = dashArray ? ` stroke-dasharray="${dashArray}"` : ''
      return `      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="2"${dashAttr} />`
    })
    .filter(Boolean)
    .join('\n')

  const width = Math.round(Math.max(...nodes.map((node) => node.position.x - minX + dims.get(node.id)!.width))) + CANVAS_MARGIN
  const height =
    Math.round(Math.max(...nodes.map((node) => node.position.y - minY + dims.get(node.id)!.height))) + CANVAS_MARGIN

  return `<!-- Generated by Diagram Lab: static topology diagram, no JS runtime required. -->
<div style="position:relative; width:${width}px; height:${height}px; font-family:${tokens.headingFont};">
  <svg width="${width}" height="${height}" style="position:absolute; inset:0;">
${edgeMarkup}
  </svg>
${nodeMarkup}
</div>`
}

export async function copyDiagramCodeToClipboard(nodes: Node[], edges: Edge[], tokens: DesignTokens): Promise<void> {
  const code = generateDiagramCode(nodes, edges, tokens)
  await navigator.clipboard.writeText(code)
}
