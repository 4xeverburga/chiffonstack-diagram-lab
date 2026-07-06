import { describe, expect, it } from 'vitest'
import { formatDualUnitLabel } from '../../src/lab/dualUnitLabel'

describe('formatDualUnitLabel', () => {
  it('groups large numbers with thousands separators and trims trailing zeros', () => {
    expect(formatDualUnitLabel(2000000, 2048)).toBe('2,000,000 msg/s · 2,048 MB/s')
  })

  it('keeps sub-1 values legible instead of rounding to 0', () => {
    expect(formatDualUnitLabel(0.4, 0.001)).toBe('0.4 msg/s · 0 MB/s')
  })

  it('separates the two units with a middle dot, not an ambiguous slash', () => {
    expect(formatDualUnitLabel(100, 0.1)).toContain(' \u00b7 ')
  })
})
