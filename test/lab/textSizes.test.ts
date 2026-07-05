import { describe, expect, it } from 'vitest'
import { DEFAULT_TEXT_SIZE, resolveTextSize, TEXT_SIZE_METRICS, TEXT_SIZES } from '../../src/lab/textSizes'

describe('textSizes vocabulary', () => {
  it('has exactly three steps', () => {
    expect(TEXT_SIZES).toEqual(['small', 'normal', 'large'])
  })

  it('defaults to normal', () => {
    expect(DEFAULT_TEXT_SIZE).toBe('normal')
  })

  it('has a complete metrics row for every step with positive values', () => {
    for (const size of TEXT_SIZES) {
      const metrics = TEXT_SIZE_METRICS[size]
      expect(metrics).toBeDefined()
      expect(metrics.fontPx).toBeGreaterThan(0)
      expect(metrics.charWidth).toBeGreaterThan(0)
      expect(metrics.nodeHeight).toBeGreaterThan(0)
      expect(metrics.labelBand).toBeGreaterThan(0)
    }
  })

  it('orders metrics so large > normal > small for every dimension', () => {
    const { small, normal, large } = TEXT_SIZE_METRICS
    for (const key of ['fontPx', 'charWidth', 'nodeHeight', 'labelBand'] as const) {
      expect(small[key]).toBeLessThan(normal[key])
      expect(normal[key]).toBeLessThan(large[key])
    }
  })

  it("normal's metrics match today's pre-existing hardcoded constants", () => {
    expect(TEXT_SIZE_METRICS.normal).toEqual({ fontPx: 13, charWidth: 7.5, nodeHeight: 40, labelBand: 20 })
  })
})

describe('resolveTextSize', () => {
  it('passes through recognized values', () => {
    expect(resolveTextSize('small')).toBe('small')
    expect(resolveTextSize('normal')).toBe('normal')
    expect(resolveTextSize('large')).toBe('large')
  })

  it('falls back to normal for undefined, missing, or unrecognized values', () => {
    expect(resolveTextSize(undefined)).toBe('normal')
    expect(resolveTextSize(null)).toBe('normal')
    expect(resolveTextSize('huge')).toBe('normal')
    expect(resolveTextSize(42)).toBe('normal')
  })
})
