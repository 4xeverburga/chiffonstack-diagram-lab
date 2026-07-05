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

  it('renders the same four handle ids as the canvas node and enables loose connection mode', () => {
    const { tsx } = exportComponentCode(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(tsx).toContain('<Handle id="top" type="source" position={Position.Top} />')
    expect(tsx).toContain('<Handle id="bottom" type="source" position={Position.Bottom} />')
    expect(tsx).toContain('<Handle id="left" type="source" position={Position.Left} />')
    expect(tsx).toContain('<Handle id="right" type="source" position={Position.Right} />')
    expect(tsx).toContain('connectionMode={ConnectionMode.Loose}')
  })

  it('serializes each edge\'s sourceHandle/targetHandle and hides handles in the generated CSS', () => {
    const edgesWithSides = [{ ...kitchenSinkEdges[0], sourceHandle: 'top', targetHandle: 'bottom' }]
    const { tsx, css } = exportComponentCode(kitchenSinkNodes, edgesWithSides, DEFAULT_DESIGN_TOKENS)
    expect(tsx).toContain('"sourceHandle": "top"')
    expect(tsx).toContain('"targetHandle": "bottom"')
    expect(css).toContain('.react-flow__handle')
    expect(css).toContain('opacity: 0')
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

  it('serializes thickness/direction and renders them as edge classes', () => {
    const { tsx } = exportComponentCode(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(tsx).toContain('"thickness": "thin"')
    expect(tsx).toContain('"thickness": "thick"')
    expect(tsx).toContain('"direction": "reverse"')
    // Legacy edge (no fields on the fixture) is normalized to explicit values.
    expect(tsx).toContain('"thickness": "normal"')
    expect(tsx).toContain('edge-w-${thickness}')
    expect(tsx).toContain("direction === 'reverse' ? ' edge-reverse' : ''")
  })

  it('emits the thickness width rules and the reverse animation rule in the generated CSS', () => {
    const { css } = exportComponentCode(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(css).toMatch(/\.chiffon-diagram \.edge-w-thin \{\s*stroke-width: 1\.5;/)
    expect(css).toMatch(/\.chiffon-diagram \.edge-w-thick \{\s*stroke-width: 4;/)
    expect(css).toMatch(/\.chiffon-diagram \.edge-reverse \{\s*animation-direction: reverse;/)
    expect(css).not.toContain('.edge-w-normal')
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
