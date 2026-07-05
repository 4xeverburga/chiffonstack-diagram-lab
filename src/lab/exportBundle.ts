import { zipSync, type Zippable } from 'fflate'
import type { Edge, Node } from '@xyflow/react'
import type { DesignTokens } from './designTokens'
import { exportComponentCode } from './exportComponentCode'
import { serializeDiagram } from './exportDiagram'
import { promptTemplate } from './promptTemplate'
import { nodeImage } from './exportGeometry'

// Zip entries carry a modification time by default (fflate defaults to
// "now"), which would make the same diagram produce a different zip byte-
// for-byte on every export. Pin it so output is deterministic
// (contracts/bundle.md). fflate reads the year in local time, so this uses
// the local-time Date constructor (rather than a UTC ISO string) to stay
// safely inside the zip DOS date format's 1980–2099 range in every timezone.
const FIXED_MTIME = new Date(2000, 0, 1)

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/jpeg': 'jpg',
}

function dataUriToBytes(dataUri: string): { bytes: Uint8Array; extension: string } {
  const match = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,(.*)$/s.exec(dataUri)
  if (!match) {
    throw new Error(`Diagram Lab: expected a base64 image data URI, got: ${dataUri.slice(0, 32)}…`)
  }
  const [, mime, base64] = match
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return { bytes, extension: MIME_EXTENSIONS[mime] ?? 'bin' }
}

// Ids can contain characters that aren't filesystem-safe; keep uniqueness by
// substituting rather than stripping.
function sanitizeAssetName(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_')
}

// Packages the diagram into `diagram-bundle.zip`: the component export,
// canonical JSON, decoded image assets, and an integration prompt — enough
// for a coding agent to do the integration unassisted (SC-003).
// Throws on empty input; the UI layer guards that case.
export function exportBundle(nodes: Node[], edges: Edge[], tokens: DesignTokens): Uint8Array {
  if (nodes.length === 0) {
    throw new Error('Diagram Lab: add nodes to the canvas before downloading a bundle.')
  }

  const { tsx, css } = exportComponentCode(nodes, edges, tokens)
  const diagramJson = serializeDiagram(nodes, edges)

  const assetEntries: Record<string, Uint8Array> = {}
  for (const node of nodes) {
    const image = nodeImage(node)
    if (!image) continue
    const { bytes, extension } = dataUriToBytes(image)
    assetEntries[`assets/node-${sanitizeAssetName(node.id)}.${extension}`] = bytes
  }

  const promptMd = promptTemplate(tokens, Object.keys(assetEntries).length > 0, nodes.length, edges.length)

  const encoder = new TextEncoder()
  const zippable: Zippable = {
    'Diagram.tsx': [encoder.encode(tsx), { mtime: FIXED_MTIME }],
    'diagram.css': [encoder.encode(css), { mtime: FIXED_MTIME }],
    'diagram.json': [encoder.encode(diagramJson), { mtime: FIXED_MTIME }],
    'prompt.md': [encoder.encode(promptMd), { mtime: FIXED_MTIME }],
  }
  for (const [path, bytes] of Object.entries(assetEntries)) {
    zippable[path] = [bytes, { mtime: FIXED_MTIME }]
  }

  return zipSync(zippable, { mtime: FIXED_MTIME })
}

export function downloadBundle(nodes: Node[], edges: Edge[], tokens: DesignTokens): void {
  const bytes = exportBundle(nodes, edges, tokens)
  // Blob's DOM lib type wants an ArrayBuffer-backed view; zipSync's return
  // type is typed against the wider ArrayBufferLike (which also covers
  // SharedArrayBuffer). The buffer really is a plain ArrayBuffer at runtime.
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'diagram-bundle.zip'
  anchor.click()
  URL.revokeObjectURL(url)
}
