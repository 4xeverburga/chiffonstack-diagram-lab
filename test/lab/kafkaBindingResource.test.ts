import { describe, expect, it } from 'vitest'
import { deriveBindingResource } from '../../src/lab/kafkaBindingResource'
import type { FormulaDescriptor } from '../../src/engine/ports'

function descriptor(id: string, isBinding: boolean): FormulaDescriptor {
  return { id, name: id, expression: '', inputs: {}, sources: [{ title: 't', url: 'https://example.com' }], isBinding }
}

describe('deriveBindingResource', () => {
  it('returns undefined for undefined or empty input', () => {
    expect(deriveBindingResource(undefined)).toBeUndefined()
    expect(deriveBindingResource([])).toBeUndefined()
  })

  it('returns undefined when nothing is binding', () => {
    const descriptors = [
      descriptor('kafka.network.ingress-ceiling', false),
      descriptor('kafka.cpu.ingress-ceiling', false),
      descriptor('kafka.disk.ingress-ceiling', false),
    ]
    expect(deriveBindingResource(descriptors)).toBeUndefined()
  })

  it('maps each ingress-ceiling formula to its resource when binding', () => {
    expect(deriveBindingResource([descriptor('kafka.network.ingress-ceiling', true)])).toBe('network')
    expect(deriveBindingResource([descriptor('kafka.cpu.ingress-ceiling', true)])).toBe('cpu')
    expect(deriveBindingResource([descriptor('kafka.disk.ingress-ceiling', true)])).toBe('disk')
  })

  it('gives disk-cliff formulas precedence over ingress-ceiling formulas', () => {
    const descriptors = [
      descriptor('kafka.network.ingress-ceiling', true),
      descriptor('kafka.disk-cliff.threshold', true),
      descriptor('kafka.disk-cliff.read-ceiling', true),
    ]
    expect(deriveBindingResource(descriptors)).toBe('disk')
  })
})
