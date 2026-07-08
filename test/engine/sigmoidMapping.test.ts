import { describe, expect, it } from 'vitest'
import { DEFAULT_SIGMOID_MAPPING_CONFIG } from '../../src/engine/config'
import { mapThroughputToAnimation } from '../../src/engine/sigmoidMapping'

describe('mapThroughputToAnimation', () => {
  it('never produces a duration outside [durationMinSec, durationMaxSec]', () => {
    for (const throughput of [0, 1, 10, 100, 1000, 1e6, 1e12]) {
      const { durationSec } = mapThroughputToAnimation(throughput, DEFAULT_SIGMOID_MAPPING_CONFIG)
      expect(durationSec).toBeGreaterThanOrEqual(DEFAULT_SIGMOID_MAPPING_CONFIG.durationMinSec)
      expect(durationSec).toBeLessThanOrEqual(DEFAULT_SIGMOID_MAPPING_CONFIG.durationMaxSec)
    }
  })

  it('never produces a dash density outside [densityMin, densityMax]', () => {
    for (const throughput of [0, 1, 10, 100, 1000, 1e6, 1e12]) {
      const { dashDensity } = mapThroughputToAnimation(throughput, DEFAULT_SIGMOID_MAPPING_CONFIG)
      expect(dashDensity).toBeGreaterThanOrEqual(DEFAULT_SIGMOID_MAPPING_CONFIG.densityMin)
      expect(dashDensity).toBeLessThanOrEqual(DEFAULT_SIGMOID_MAPPING_CONFIG.densityMax)
    }
  })

  it('is monotonic: duration decreases (faster) as throughput grows', () => {
    const low = mapThroughputToAnimation(1, DEFAULT_SIGMOID_MAPPING_CONFIG)
    const mid = mapThroughputToAnimation(100, DEFAULT_SIGMOID_MAPPING_CONFIG)
    const high = mapThroughputToAnimation(1_000_000, DEFAULT_SIGMOID_MAPPING_CONFIG)
    expect(low.durationSec).toBeGreaterThan(mid.durationSec)
    expect(mid.durationSec).toBeGreaterThan(high.durationSec)
  })

  it('is monotonic: dash density increases as throughput grows', () => {
    const low = mapThroughputToAnimation(1, DEFAULT_SIGMOID_MAPPING_CONFIG)
    const mid = mapThroughputToAnimation(100, DEFAULT_SIGMOID_MAPPING_CONFIG)
    const high = mapThroughputToAnimation(1_000_000, DEFAULT_SIGMOID_MAPPING_CONFIG)
    expect(low.dashDensity).toBeLessThan(mid.dashDensity)
    expect(mid.dashDensity).toBeLessThan(high.dashDensity)
  })

  it('treats negative throughput the same as zero rather than throwing or going out of bounds', () => {
    const negative = mapThroughputToAnimation(-50, DEFAULT_SIGMOID_MAPPING_CONFIG)
    const zero = mapThroughputToAnimation(0, DEFAULT_SIGMOID_MAPPING_CONFIG)
    expect(negative).toEqual(zero)
  })
})
