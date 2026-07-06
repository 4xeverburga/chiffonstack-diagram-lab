import { describe, expect, it } from 'vitest'
import { applyHostStatusClass } from '../../src/lab/hostStatusTreatment'

describe('applyHostStatusClass', () => {
  it('adds no status token for a healthy host', () => {
    expect(applyHostStatusClass('node', 'healthy')).toBe('node')
    expect(applyHostStatusClass('node', undefined)).toBe('node')
  })

  it('appends the saturated token', () => {
    expect(applyHostStatusClass('node', 'saturated')).toBe('node sim-status-saturated')
  })

  it('appends the overloaded token', () => {
    expect(applyHostStatusClass('node', 'overloaded')).toBe('node sim-status-overloaded')
  })

  it('is idempotent: recomputing from an already-decorated className never duplicates the token', () => {
    const once = applyHostStatusClass('node', 'saturated')
    const twice = applyHostStatusClass(once, 'saturated')
    expect(twice).toBe(once)
  })

  it('swaps the token when status changes without leaving the old one behind', () => {
    const saturated = applyHostStatusClass('node', 'saturated')
    const overloaded = applyHostStatusClass(saturated, 'overloaded')
    expect(overloaded).toBe('node sim-status-overloaded')
  })

  it('removes the token entirely once status returns to healthy', () => {
    const saturated = applyHostStatusClass('node', 'saturated')
    expect(applyHostStatusClass(saturated, 'healthy')).toBe('node')
  })

  it('handles an undefined base className', () => {
    expect(applyHostStatusClass(undefined, 'saturated')).toBe('sim-status-saturated')
  })
})
