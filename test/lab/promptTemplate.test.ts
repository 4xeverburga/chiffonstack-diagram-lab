import { describe, expect, it } from 'vitest'
import { promptTemplate } from '../../src/lab/promptTemplate'
import { DEFAULT_DESIGN_TOKENS } from '../../src/lab/designTokens'

describe('promptTemplate', () => {
  it('documents what the bundle is', () => {
    const md = promptTemplate(DEFAULT_DESIGN_TOKENS, false, 3, 2)
    expect(md).toContain('self-contained, animated architecture')
    expect(md).toContain('3 node(s)')
    expect(md).toContain('2 edge(s)')
  })

  it('lists the file inventory, including assets/ only when images are present', () => {
    const withoutAssets = promptTemplate(DEFAULT_DESIGN_TOKENS, false, 1, 0)
    expect(withoutAssets).toContain('Diagram.tsx')
    expect(withoutAssets).toContain('diagram.json')
    expect(withoutAssets).toContain('prompt.md')
    expect(withoutAssets).not.toContain('`assets/`')

    const withAssets = promptTemplate(DEFAULT_DESIGN_TOKENS, true, 1, 0)
    expect(withAssets).toContain('`assets/`')
  })

  it('documents the four-token contract with current values', () => {
    const tokens = { primaryColor: '#111111', secondaryColor: '#222222', headingFont: 'Head', bodyFont: 'Body' }
    const md = promptTemplate(tokens, false, 1, 0)
    expect(md).toContain('#111111')
    expect(md).toContain('#222222')
    expect(md).toContain('Head')
    expect(md).toContain('Body')
    expect(md).toContain('--token-primary')
    expect(md).toContain('--token-secondary')
  })

  it('documents integration steps and a verification checklist', () => {
    const md = promptTemplate(DEFAULT_DESIGN_TOKENS, false, 1, 0)
    expect(md).toContain('npm install @xyflow/react')
    expect(md).toContain('Verification checklist')
    expect(md).toContain('Heat-flow edges animate')
  })
})
