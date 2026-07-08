import { describe, expect, it } from 'vitest'
import { FORMULA_PANEL_DISCLAIMER, describeFormulaPanelState } from '../../src/lab/formulaPanelState'
import type { FormulaDescriptor } from '../../src/engine/ports'

const descriptor: FormulaDescriptor = {
  id: 'host.saturation-ratio',
  name: 'Saturation ratio',
  expression: 'x = y / z',
  inputs: {},
  sources: [{ title: 't', url: 'https://example.com' }],
  isBinding: true,
}

describe('describeFormulaPanelState', () => {
  it('reports hasFormulas when descriptors are present', () => {
    expect(describeFormulaPanelState([descriptor], { kind: 'host', profile: 'client_pool', requestRatePerSec: 100 })).toEqual({
      hasFormulas: true,
      emptyMessage: '',
    })
  })

  it('gives a queue a specific explanation, not a generic empty message', () => {
    const state = describeFormulaPanelState(undefined, { kind: 'queue' })
    expect(state.hasFormulas).toBe(false)
    expect(state.emptyMessage.toLowerCase()).toContain('queue')
  })

  it('gives a no-role node a generic explanation', () => {
    const state = describeFormulaPanelState([], undefined)
    expect(state.hasFormulas).toBe(false)
    expect(state.emptyMessage.length).toBeGreaterThan(0)
    expect(state.emptyMessage.toLowerCase()).not.toContain('placeholder')
  })

  it('always exposes a non-empty standing disclaimer', () => {
    expect(FORMULA_PANEL_DISCLAIMER.length).toBeGreaterThan(0)
  })
})
