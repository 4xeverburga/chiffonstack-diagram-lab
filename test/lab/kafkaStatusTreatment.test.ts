import { describe, expect, it } from 'vitest'
import { applyKafkaStatusClass } from '../../src/lab/kafkaStatusTreatment'

describe('applyKafkaStatusClass', () => {
  it('adds the status class for saturated/degraded and none for healthy/undefined', () => {
    expect(applyKafkaStatusClass('node', 'saturated')).toBe('node sim-status-saturated')
    expect(applyKafkaStatusClass('node', 'degraded')).toBe('node sim-status-degraded')
    expect(applyKafkaStatusClass('node', 'healthy')).toBe('node')
    expect(applyKafkaStatusClass('node', undefined)).toBe('node')
  })

  it('is idempotent: repeated calls with the same status never duplicate the token', () => {
    let className: string | undefined = 'node'
    for (let i = 0; i < 5; i += 1) {
      className = applyKafkaStatusClass(className, 'saturated')
    }
    expect(className).toBe('node sim-status-saturated')
  })

  it('replaces rather than appends when status changes', () => {
    const saturated = applyKafkaStatusClass('node handles-visible', 'saturated')
    const degraded = applyKafkaStatusClass(saturated, 'degraded')
    expect(degraded).toBe('node handles-visible sim-status-degraded')
    expect(degraded).not.toContain('sim-status-saturated')
  })

  it('clears any existing treatment when status returns to healthy or undefined', () => {
    const saturated = applyKafkaStatusClass('node', 'saturated')
    expect(applyKafkaStatusClass(saturated, 'healthy')).toBe('node')
    expect(applyKafkaStatusClass(saturated, undefined)).toBe('node')
  })

  it('handles an undefined base className', () => {
    expect(applyKafkaStatusClass(undefined, 'saturated')).toBe('sim-status-saturated')
    expect(applyKafkaStatusClass(undefined, undefined)).toBe('')
  })
})
