import { describe, expect, it } from 'vitest'
import { componentCodeSnippet, exportComponentCode } from '../../src/lab/exportComponentCode'
import { DEFAULT_DESIGN_TOKENS } from '../../src/lab/designTokens'
import { kitchenSinkEdges, kitchenSinkNodes } from './fixtures/kitchenSink'
import { HOSTILE_LABEL, hostileLabelNode } from './fixtures/hostileLabel'

describe('exportComponentCode', () => {
  it('throws on an empty canvas', () => {
    expect(() => exportComponentCode([], [], DEFAULT_DESIGN_TOKENS)).toThrow()
  })

  it('is deterministic: same input produces byte-identical output', () => {
    const first = exportComponentCode(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    const second = exportComponentCode(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(second).toEqual(first)
  })

  it('exports a default Diagram component importing only react + @xyflow/react', () => {
    const { tsx } = exportComponentCode(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(tsx).toContain('export default function Diagram')
    expect(tsx).toContain("from '@xyflow/react'")
    expect(tsx).toContain("import './diagram.css'")
  })

  it('locks the exported ReactFlow down to display-only interaction', () => {
    const { tsx } = exportComponentCode(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(tsx).toContain('nodesDraggable={false}')
    expect(tsx).toContain('nodesConnectable={false}')
    expect(tsx).toContain('elementsSelectable={false}')
    expect(tsx).toContain('fitView')
  })

  it('applies tokens only as --token-* custom properties, never hard-coded brand values', () => {
    const tokens = { primaryColor: '#123456', secondaryColor: '#abcdef', headingFont: 'Custom Heading', bodyFont: 'Custom Body' }
    const { tsx, css } = exportComponentCode(kitchenSinkNodes, kitchenSinkEdges, tokens)
    expect(tsx).toContain('#123456')
    expect(tsx).toContain('#abcdef')
    expect(css).not.toContain('#123456')
    expect(css).not.toContain('#ff4715')
    expect(css).not.toContain('#ff8e05')
  })

  it('preserves every node kind, image, manual resize, and edge variant', () => {
    const { tsx } = exportComponentCode(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(tsx).toContain('"className": "node node-active"')
    expect(tsx).toContain('"className": "node node-dim"')
    expect(tsx).toContain('data:image/png;base64')
    expect(tsx).toContain('"width": 220')
    expect(tsx).toContain('"height": 96')
    expect(tsx).toContain('"variant": "heat-flow"')
    expect(tsx).toContain('"variant": "heat-static"')
    expect(tsx).toContain('"variant": "dashed"')
    expect(tsx).toContain('"variant": "default"')
  })

  it('includes the heat-flow keyframes and a reduced-motion override', () => {
    const { css } = exportComponentCode(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(css).toContain('@keyframes chiffon-heat-flow')
    expect(css).toContain('prefers-reduced-motion: reduce')
  })

  it('escapes hostile labels safely as JS string literals', () => {
    const hostileNodes = [hostileLabelNode(kitchenSinkNodes[0])]
    const { tsx } = exportComponentCode(hostileNodes, [], DEFAULT_DESIGN_TOKENS)
    expect(tsx).toContain(JSON.stringify(HOSTILE_LABEL))
  })
})

describe('componentCodeSnippet', () => {
  it('concatenates diagram.css and Diagram.tsx with file markers', () => {
    const snippet = componentCodeSnippet(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(snippet).toContain('/* ─── diagram.css */')
    expect(snippet).toContain('// ─── Diagram.tsx')
  })
})
