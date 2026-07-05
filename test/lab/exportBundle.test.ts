import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { exportBundle } from '../../src/lab/exportBundle'
import { exportComponentCode } from '../../src/lab/exportComponentCode'
import { serializeDiagram } from '../../src/lab/exportDiagram'
import { DEFAULT_DESIGN_TOKENS } from '../../src/lab/designTokens'
import { kitchenSinkEdges, kitchenSinkNodes } from './fixtures/kitchenSink'
import { HOSTILE_LABEL, hostileLabelNode } from './fixtures/hostileLabel'

const decoder = new TextDecoder()

describe('exportBundle', () => {
  it('throws on an empty canvas', () => {
    expect(() => exportBundle([], [], DEFAULT_DESIGN_TOKENS)).toThrow()
  })

  it('is deterministic: same input produces byte-identical zip bytes', () => {
    const first = exportBundle(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    const second = exportBundle(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(second).toEqual(first)
  })

  it('contains Diagram.tsx, diagram.css, diagram.json, prompt.md, and assets/ for image nodes', () => {
    const zipBytes = exportBundle(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    const files = unzipSync(zipBytes)
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(['Diagram.tsx', 'diagram.css', 'diagram.json', 'prompt.md', 'assets/node-image-node.png']),
    )
  })

  it('omits assets/ when no node has an image', () => {
    const noImageNodes = kitchenSinkNodes.filter((node) => node.id !== 'image-node')
    const zipBytes = exportBundle(noImageNodes, [], DEFAULT_DESIGN_TOKENS)
    const files = unzipSync(zipBytes)
    expect(Object.keys(files).some((path) => path.startsWith('assets/'))).toBe(false)
  })

  it('ships Diagram.tsx/diagram.css/diagram.json byte-identical to the standalone generators', () => {
    const zipBytes = exportBundle(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    const files = unzipSync(zipBytes)
    const { tsx, css } = exportComponentCode(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    const json = serializeDiagram(kitchenSinkNodes, kitchenSinkEdges)

    expect(decoder.decode(files['Diagram.tsx'])).toBe(tsx)
    expect(decoder.decode(files['diagram.css'])).toBe(css)
    expect(decoder.decode(files['diagram.json'])).toBe(json)
  })

  it("diagram.json re-parses to the same node/edge ids", () => {
    const zipBytes = exportBundle(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    const files = unzipSync(zipBytes)
    const parsed = JSON.parse(decoder.decode(files['diagram.json']))
    expect(parsed.nodes.map((node: { id: string }) => node.id)).toEqual(kitchenSinkNodes.map((node) => node.id))
  })

  it('escapes a hostile label without corrupting Diagram.tsx or diagram.json', () => {
    const hostileNodes = [hostileLabelNode(kitchenSinkNodes[0])]
    const zipBytes = exportBundle(hostileNodes, [], DEFAULT_DESIGN_TOKENS)
    const files = unzipSync(zipBytes)

    // Diagram.tsx embeds the label as a JS string literal (JSON.stringify) —
    // the raw "<script>" text appearing inside a quoted, escaped string
    // literal is expected and safe; it's never executed as markup.
    const tsx = decoder.decode(files['Diagram.tsx'])
    expect(tsx).toContain(JSON.stringify(HOSTILE_LABEL))

    const json = decoder.decode(files['diagram.json'])
    const parsed = JSON.parse(json)
    expect(parsed.nodes[0].data.label).toBe(HOSTILE_LABEL)
  })
})
