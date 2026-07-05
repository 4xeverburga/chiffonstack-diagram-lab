import { describe, expect, it } from 'vitest'
import { exportSvg } from '../../src/lab/exportSvg'
import { DEFAULT_DESIGN_TOKENS } from '../../src/lab/designTokens'
import { kitchenSinkEdges, kitchenSinkNodes } from './fixtures/kitchenSink'
import { hostileLabelNode } from './fixtures/hostileLabel'

describe('exportSvg', () => {
  it('throws on an empty canvas', () => {
    expect(() => exportSvg([], [], DEFAULT_DESIGN_TOKENS)).toThrow()
  })

  it('is deterministic: same input produces identical output', () => {
    const first = exportSvg(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    const second = exportSvg(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(second).toBe(first)
  })

  it('has zero <script> tags and no external href/url() references', () => {
    const svg = exportSvg(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(svg).not.toContain('<script')
    // href attributes may only be data: URIs (embedded images), never http(s)/relative
    const hrefs = [...svg.matchAll(/href="([^"]*)"/g)].map((match) => match[1])
    for (const href of hrefs) expect(href.startsWith('data:')).toBe(true)
    expect(svg).not.toMatch(/url\(\s*['"]?(https?:|\/\/)/i)
  })

  it('embeds the heat-flow keyframes and a prefers-reduced-motion override', () => {
    const svg = exportSvg(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(svg).toContain('@keyframes chiffon-heat-flow')
    expect(svg).toContain('prefers-reduced-motion: reduce')
    expect(svg).toContain('stroke-dashoffset')
  })

  it('is a single root <svg> with a fitted viewBox', () => {
    const svg = exportSvg(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(svg.trim().startsWith('<svg')).toBe(true)
    expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/)
  })

  it('preserves fidelity: node kinds, image, resize, and all four edge variants', () => {
    const svg = exportSvg(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(svg).toContain('class="node"')
    expect(svg).toContain('class="node node-active"')
    expect(svg).toContain('class="node node-dim"')
    expect(svg).toContain('<image href="data:image/png;base64,')
    expect(svg).toContain('class="edge edge-default edge-w-thin"')
    expect(svg).toContain('class="edge edge-dashed edge-w-thick"')
    expect(svg).toContain('class="edge edge-heat-flow edge-w-normal edge-reverse"')
    expect(svg).toContain('class="edge edge-heat-static edge-w-normal"')
  })

  it('embeds the thickness width rules and the reverse animation rule', () => {
    const svg = exportSvg(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(svg).toMatch(/\.edge-w-thin\s*\{\s*stroke-width: 1\.5;/)
    expect(svg).toMatch(/\.edge-w-thick\s*\{\s*stroke-width: 4;/)
    expect(svg).toMatch(/\.edge-reverse\s*\{\s*animation-direction: reverse;/)
    // No .edge-w-normal rule: "normal" renders each variant's baseline width
    // so pre-003 diagrams look identical (contracts/edge-style.md).
    expect(svg).not.toContain('.edge-w-normal')
  })

  it('honors a manually resized node dimensions', () => {
    const svg = exportSvg(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(svg).toContain('width="220" height="96"')
  })

  it('applies the labelSize class to each node\'s text and normalizes legacy nodes to normal', () => {
    const svg = exportSvg(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(svg).toContain('<text class="node-label node-label-large"')
    expect(svg).toContain('<text class="node-label node-label-small"')
    expect(svg).toContain('<text class="node-label node-label-normal"')
  })

  it('embeds the size font-size rules matching the metric map', () => {
    const svg = exportSvg(kitchenSinkNodes, kitchenSinkEdges, DEFAULT_DESIGN_TOKENS)
    expect(svg).toMatch(/\.node-label-small\s*\{\s*font-size: 11px;/)
    expect(svg).toMatch(/\.node-label-large\s*\{\s*font-size: 16px;/)
  })

  it('scales an image node\'s label band (and therefore its image height) with its labelSize', () => {
    const PIXEL_PNG =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    const smallImageNode = { id: 'img-small', type: 'labelNode', position: { x: 0, y: 0 }, data: { label: 'i', image: PIXEL_PNG, labelSize: 'small' } }
    const largeImageNode = { id: 'img-large', type: 'labelNode', position: { x: 0, y: 0 }, data: { label: 'i', image: PIXEL_PNG, labelSize: 'large' } }
    const svgSmall = exportSvg([smallImageNode], [], DEFAULT_DESIGN_TOKENS)
    const svgLarge = exportSvg([largeImageNode], [], DEFAULT_DESIGN_TOKENS)
    const imageHeight = (svg: string) => Number(svg.match(/<image[^>]*height="([\d.]+)"/)?.[1])
    const nodeBoxHeight = (svg: string) => Number(svg.match(/<rect[^>]*height="([\d.]+)"/)?.[1])
    // A large node's overall box grows more than its label band does, so its
    // image area ends up bigger too — the labelBand metric change is
    // observable both in the box height and in how much of it the image gets.
    expect(nodeBoxHeight(svgLarge)).toBeGreaterThan(nodeBoxHeight(svgSmall))
    expect(imageHeight(svgLarge)).toBeGreaterThan(imageHeight(svgSmall))
  })

  it('anchors edge paths on the side each edge records, not the legacy right/left pair', () => {
    const defaultSideEdges = [{ ...kitchenSinkEdges[0], sourceHandle: undefined, targetHandle: undefined }]
    const explicitSideEdges = [{ ...kitchenSinkEdges[0], sourceHandle: 'top', targetHandle: 'bottom' }]
    const defaultSvg = exportSvg(kitchenSinkNodes, defaultSideEdges, DEFAULT_DESIGN_TOKENS)
    const explicitSvg = exportSvg(kitchenSinkNodes, explicitSideEdges, DEFAULT_DESIGN_TOKENS)
    const pathFrom = (svg: string) => svg.match(/<path class="edge edge-default[^"]*" d="([^"]+)"/)?.[1]
    expect(pathFrom(explicitSvg)).not.toBe(pathFrom(defaultSvg))
  })

  it('escapes hostile labels for safe XML text', () => {
    const hostileNodes = [hostileLabelNode(kitchenSinkNodes[0])]
    const svg = exportSvg(hostileNodes, [], DEFAULT_DESIGN_TOKENS)
    expect(svg).not.toContain('<script>alert')
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).toContain('&amp;')
  })

  it('escapes hostile font tokens without breaking out of the <style> block', () => {
    const tokens = { ...DEFAULT_DESIGN_TOKENS, headingFont: `</style><script>x</script>, sans-serif` }
    const svg = exportSvg(kitchenSinkNodes, kitchenSinkEdges, tokens)
    expect(svg).not.toContain('</style><script>')
    expect(svg).toContain('&lt;/style&gt;')
  })
})
