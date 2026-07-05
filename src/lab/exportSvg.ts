import type { Edge, Node } from '@xyflow/react'
import type { DesignTokens } from './designTokens'
import { classNameForKind, kindForClassName } from './nodeKinds'
import { edgeStyleClassNames, THICKNESS_STROKE_WIDTH } from './edgeStyle'
import { CANVAS_MARGIN, computeContentSize, computeEdgePaths, computeNodeBoxes, nodeImage, nodeLabel } from './exportGeometry'
import { labelBandFor, resolveTextSize, TEXT_SIZE_METRICS } from './textSizes'

const GENERIC_FONT_KEYWORDS = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
])

function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeXmlAttr(value: string): string {
  return escapeXmlText(value).replace(/"/g, '&quot;')
}

// CSS custom properties land in the <style> block as raw text, not through
// JSON.stringify's string-literal escaping, so font names get their own
// quoting: each non-generic segment is wrapped in quotes with `\`/`"`
// escaped, while a trailing generic keyword (sans-serif, monospace, ...)
// from the token value is left unquoted so it still resolves as a CSS
// fallback instead of a literal font name (research.md decision #8).
function escapeCssFontFamily(value: string): string {
  const segments = value
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (segments.length === 0) return '"sans-serif"'
  return segments
    .map((segment) =>
      GENERIC_FONT_KEYWORDS.has(segment.toLowerCase()) ? segment : `"${segment.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
    )
    .join(', ')
}

const IMAGE_SIDE_PADDING = 8
const IMAGE_TOP_PADDING = 6

// Generates a single self-contained, animated SVG document: zero <script>,
// zero external references (images inline as data URIs), styled only by the
// four design tokens, that keeps playing its heat-flow animation even
// embedded via <img> and still reads as a complete static frame wherever
// animation doesn't run — design-tool import, prefers-reduced-motion
// (specs/001-export-suite/contracts/animated-svg.md). Replaces the static
// HTML snippet export (exportCode.ts) per FR-006.
// Throws on empty input; the UI layer (useExportActions.ts) guards that case.
export function exportSvg(nodes: Node[], edges: Edge[], tokens: DesignTokens): string {
  if (nodes.length === 0) {
    throw new Error('Diagram Lab: add nodes to the canvas before exporting an SVG.')
  }

  const boxes = computeNodeBoxes(nodes)
  const edgePaths = computeEdgePaths(edges, boxes)
  const { width, height } = computeContentSize(boxes, CANVAS_MARGIN)

  const edgeMarkup = edgePaths
    .map((edge) => `    <path class="${edgeStyleClassNames(edge.variant, edge.thickness, edge.direction, 'edge')}" d="${edge.d}" />`)
    .join('\n')

  const nodeMarkup = nodes
    .map((node) => {
      const box = boxes.get(node.id)!
      const className = classNameForKind(kindForClassName(node.className))
      const label = nodeLabel(node)
      const image = nodeImage(node)
      const labelSize = resolveTextSize(node.data.labelSize)
      const labelBandHeight = labelBandFor(label, labelSize)

      const labelY = image ? box.y + box.height - labelBandHeight / 2 : box.y + box.height / 2
      const imageMarkup = image
        ? `\n      <image href="${escapeXmlAttr(image)}" x="${box.x + IMAGE_SIDE_PADDING}" y="${box.y + IMAGE_TOP_PADDING}" width="${box.width - IMAGE_SIDE_PADDING * 2}" height="${box.height - labelBandHeight - IMAGE_TOP_PADDING}" preserveAspectRatio="xMidYMid meet" />`
        : ''

      return `    <g class="${className}">
      <rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="8" />${imageMarkup}
      <text class="node-label node-label-${labelSize}" x="${box.x + box.width / 2}" y="${labelY}">${escapeXmlText(label)}</text>
    </g>`
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <style>
    :root {
      --token-primary: ${escapeXmlText(tokens.primaryColor)};
      --token-secondary: ${escapeXmlText(tokens.secondaryColor)};
      --token-heading-font: ${escapeXmlText(escapeCssFontFamily(tokens.headingFont))};
      --token-body-font: ${escapeXmlText(escapeCssFontFamily(tokens.bodyFont))};
    }
    .node {
      fill: #fff;
      stroke: var(--token-secondary);
      stroke-width: 1;
    }
    .node-active {
      stroke: var(--token-primary);
    }
    .node-dim {
      stroke-dasharray: 4 4;
    }
    .node-label {
      font-family: var(--token-body-font);
      font-size: 13px;
      text-anchor: middle;
      dominant-baseline: middle;
      fill: #111;
    }
    .node-label-small {
      font-size: ${TEXT_SIZE_METRICS.small.fontPx}px;
    }
    .node-label-large {
      font-size: ${TEXT_SIZE_METRICS.large.fontPx}px;
    }
    .node-dim .node-label {
      fill: rgba(0, 0, 0, 0.55);
    }
    .edge {
      fill: none;
    }
    .edge-heat-flow {
      stroke: var(--token-primary);
      stroke-width: 2.5;
      stroke-dasharray: 6 6;
      animation: chiffon-heat-flow 0.7s linear infinite;
    }
    .edge-heat-static {
      stroke: var(--token-primary);
      stroke-width: 2.5;
    }
    .edge-dashed {
      stroke: var(--token-secondary);
      stroke-width: 2;
      stroke-dasharray: 4 4;
    }
    .edge-default {
      stroke: var(--token-secondary);
      stroke-width: 2;
    }
    .edge-w-thin {
      stroke-width: ${THICKNESS_STROKE_WIDTH.thin};
    }
    .edge-w-thick {
      stroke-width: ${THICKNESS_STROKE_WIDTH.thick};
    }
    .edge-reverse {
      animation-direction: reverse;
    }
    @keyframes chiffon-heat-flow {
      from {
        stroke-dashoffset: 24;
      }
      to {
        stroke-dashoffset: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .edge-heat-flow {
        animation: none;
      }
    }
  </style>
${edgeMarkup}
${nodeMarkup}
</svg>
`
}

export async function copySvgToClipboard(nodes: Node[], edges: Edge[], tokens: DesignTokens): Promise<void> {
  const svg = exportSvg(nodes, edges, tokens)
  await navigator.clipboard.writeText(svg)
}

export function downloadSvg(nodes: Node[], edges: Edge[], tokens: DesignTokens): void {
  const svg = exportSvg(nodes, edges, tokens)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'diagram.svg'
  anchor.click()
  URL.revokeObjectURL(url)
}
