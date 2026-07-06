import { describe, expect, it } from 'vitest'
import { resolveKafkaHardwareProfile } from '../../src/engine/kafkaCatalog'
import {
  buildKafkaFormulaDescriptors,
  cpuIngressCeilingMBps,
  deriveKafkaStatus,
  diskCliffActive,
  diskCliffReadCeilingMBps,
  networkIngressCeilingMBps,
  pageCacheCapacityBytes,
  saturationRatio,
  validateFormulaDescriptorsHaveSources,
} from '../../src/engine/kafkaFormulas'

describe('kafka formulas', () => {
  it('computes network ceiling from replication factor', () => {
    const profile = resolveKafkaHardwareProfile('m6i.xlarge')
    expect(networkIngressCeilingMBps(profile, 4)).toBeCloseTo(profile.networkMBps / 4)
  })

  it('increases CPU pressure when TLS and zstd are enabled', () => {
    const profile = resolveKafkaHardwareProfile('m6i.xlarge')
    const off = cpuIngressCeilingMBps(profile, false, 'none', 12)
    const on = cpuIngressCeilingMBps(profile, true, 'zstd', 12)
    expect(on).toBeLessThan(off)
  })

  it('computes saturation ratio and status precedence correctly', () => {
    expect(saturationRatio(200, 100)).toBe(2)
    expect(deriveKafkaStatus(false, 0.1, 1, 0.2)).toBe('saturated')
    expect(deriveKafkaStatus(true, 2, 2, 2)).toBe('degraded')
    expect(deriveKafkaStatus(false, 0.1, 0.2, 0.3)).toBe('healthy')
  })

  it('computes page cache and disk cliff threshold behavior', () => {
    const profile = resolveKafkaHardwareProfile('m6i.large')
    const cacheBytes = pageCacheCapacityBytes(profile)
    expect(cacheBytes).toBeGreaterThan(0)
    expect(diskCliffActive(cacheBytes - 1, cacheBytes)).toBe(false)
    expect(diskCliffActive(cacheBytes + 1, cacheBytes)).toBe(true)
    expect(diskCliffReadCeilingMBps(profile)).toBeLessThan(profile.diskMBps)
  })

  it('enforces structural source citation gate for formula descriptors', () => {
    const profile = resolveKafkaHardwareProfile('m6i.xlarge')
    const descriptors = buildKafkaFormulaDescriptors({
      offeredIngressMBps: 10,
      networkCeilingMBps: 100,
      cpuCeilingMBps: 120,
      diskCeilingMBps: 80,
      lagBytes: 0,
      cacheCapacityBytes: pageCacheCapacityBytes(profile),
      diskCliff: false,
      profile,
      tlsEnabled: false,
      compression: 'none',
      partitions: 12,
      replicationFactor: 1,
    })
    expect(() => validateFormulaDescriptorsHaveSources(descriptors)).not.toThrow()
    const invalid = [{ ...descriptors[0], sources: [] }]
    expect(() => validateFormulaDescriptorsHaveSources(invalid)).toThrow('has no source citation')
  })
})
