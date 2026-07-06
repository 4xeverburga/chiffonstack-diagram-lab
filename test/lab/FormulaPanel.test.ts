import { describe, expect, it } from 'vitest'
import { FORMULA_PANEL_DISCLAIMER, describeFormulaPanelState } from '../../src/lab/formulaPanelState'
import type { FormulaDescriptor } from '../../src/engine/ports'

const descriptor: FormulaDescriptor = {
  id: 'kafka.network.ingress-ceiling',
  name: 'Network ingress ceiling',
  expression: 'x = y / z',
  inputs: {},
  sources: [{ title: 't', url: 'https://example.com' }],
  isBinding: true,
}

describe('describeFormulaPanelState', () => {
  it('reports hasFormulas when descriptors are present', () => {
    expect(describeFormulaPanelState([descriptor], { role: 'kafka', hardwareProfile: 'm6i.large', partitions: 1, replicationFactor: 1, tlsEnabled: false, compression: 'none', retentionBytes: 0 })).toEqual({
      hasFormulas: true,
      emptyMessage: '',
    })
  })

  it('gives the 008 placeholder-processor a specific explanation, not a generic empty message', () => {
    const state = describeFormulaPanelState(undefined, { role: 'processor', serviceRatePerSec: 1 })
    expect(state.hasFormulas).toBe(false)
    expect(state.emptyMessage.toLowerCase()).toContain('placeholder')
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
