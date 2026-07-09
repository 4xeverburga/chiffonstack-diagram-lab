import { describe, expect, it } from 'vitest'
import { isScalingGroupHost, projectScalingGroup, resolveReplicaTelemetry, shouldRenderScalingGroup } from '../../src/lab/scalingGroupProjection'
import { MAX_DISCRETE_CAPACITY_SEGMENTS } from 'sugar-skills'
import type { HostReplicaTelemetry } from 'sugar-skills'

function telemetry(overrides: Partial<HostReplicaTelemetry> = {}): HostReplicaTelemetry {
  return { nominalCount: 1, bootingCount: 0, effectiveCount: 1, perReplicaSaturation: 0, events: [], ...overrides }
}

describe('isScalingGroupHost', () => {
  it('is false only for min = max = 1 (spec User Story 4 scenario 1)', () => {
    expect(isScalingGroupHost(1, 1)).toBe(false)
  })

  it('is true for any other bound combination', () => {
    expect(isScalingGroupHost(1, 4)).toBe(true)
    expect(isScalingGroupHost(3, 3)).toBe(true)
    expect(isScalingGroupHost(2, 5)).toBe(true)
  })
})

describe('projectScalingGroup — segments mode (maxReplicas at or below the legibility cap)', () => {
  it('renders exactly one segment per declared replica slot, not just currently-active ones', () => {
    const projection = projectScalingGroup(telemetry({ nominalCount: 2 }), 4, null)
    expect(projection.mode).toBe('segments')
    expect(projection.segments).toHaveLength(4)
    expect(projection.segments.map((s) => s.active)).toEqual([true, true, false, false])
  })

  it('marks every declared slot active once nominalCount reaches maxReplicas — never an overflow', () => {
    const projection = projectScalingGroup(telemetry({ nominalCount: 4 }), 4, null)
    expect(projection.segments).toHaveLength(4)
    expect(projection.segments.every((s) => s.active)).toBe(true)
  })

  it('switches to segments mode exactly at the MAX_DISCRETE_CAPACITY_SEGMENTS boundary', () => {
    const atCap = projectScalingGroup(telemetry(), MAX_DISCRETE_CAPACITY_SEGMENTS, null)
    expect(atCap.mode).toBe('segments')
    expect(atCap.segments).toHaveLength(MAX_DISCRETE_CAPACITY_SEGMENTS)
  })
})

describe('projectScalingGroup — proportional mode (above the legibility cap)', () => {
  it('switches to proportional mode one slot past the cap, with no discrete segments', () => {
    const overCap = projectScalingGroup(telemetry({ nominalCount: 3 }), MAX_DISCRETE_CAPACITY_SEGMENTS + 1, null)
    expect(overCap.mode).toBe('proportional')
    expect(overCap.segments).toEqual([])
  })

  it('computes fillRatio and bootingRatio as fractions of maxReplicas', () => {
    const projection = projectScalingGroup(telemetry({ nominalCount: 20, bootingCount: 5 }), 100, null)
    expect(projection.fillRatio).toBeCloseTo(0.2)
    expect(projection.bootingRatio).toBeCloseTo(0.05)
  })

  it('never reports fillRatio above 1 for a scaler-bounded nominalCount', () => {
    // The autoscaler never lets nominalCount exceed maxReplicas (see
    // autoscaler.ts) — this sweeps every legal (nominalCount, maxReplicas)
    // pair above the segments cap to confirm the projection never implies
    // an "overflow" past 100% fill either.
    for (let maxReplicas = MAX_DISCRETE_CAPACITY_SEGMENTS + 1; maxReplicas <= MAX_DISCRETE_CAPACITY_SEGMENTS + 20; maxReplicas += 1) {
      for (let nominalCount = 1; nominalCount <= maxReplicas; nominalCount += 1) {
        const projection = projectScalingGroup(telemetry({ nominalCount }), maxReplicas, null)
        expect(projection.fillRatio).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('projectScalingGroup — booting-slot flagging', () => {
  it('flags exactly the newest active slots as booting, up to bootingCount', () => {
    const projection = projectScalingGroup(telemetry({ nominalCount: 3, bootingCount: 1 }), 4, null)
    expect(projection.segments.map((s) => s.booting)).toEqual([false, false, true, false])
  })

  it('never flags an inactive (beyond-nominal) slot as booting', () => {
    const projection = projectScalingGroup(telemetry({ nominalCount: 2, bootingCount: 5 }), 4, null)
    expect(projection.segments.filter((s) => s.booting)).toHaveLength(2)
    expect(projection.segments.filter((s) => s.booting).every((s) => s.active)).toBe(true)
  })

  it('flags zero slots when nothing is booting', () => {
    const projection = projectScalingGroup(telemetry({ nominalCount: 3, bootingCount: 0 }), 4, null)
    expect(projection.segments.every((s) => !s.booting)).toBe(true)
  })
})

describe('projectScalingGroup — determinism / pulse passthrough', () => {
  it('identical telemetry (deep-equal, not object identity) produces a deep-equal projection', () => {
    const a = projectScalingGroup(telemetry({ nominalCount: 3, bootingCount: 1 }), 4, 'up')
    const b = projectScalingGroup(telemetry({ nominalCount: 3, bootingCount: 1 }), 4, 'up')
    expect(a).toEqual(b)
  })

  it('passes the pulse argument straight through unchanged', () => {
    expect(projectScalingGroup(telemetry(), 4, 'up').pulse).toBe('up')
    expect(projectScalingGroup(telemetry(), 4, 'down').pulse).toBe('down')
    expect(projectScalingGroup(telemetry(), 4, null).pulse).toBeNull()
  })
})

describe('shouldRenderScalingGroup', () => {
  it('is false for undefined sim bounds (non-saturating profiles)', () => {
    expect(shouldRenderScalingGroup(undefined)).toBe(false)
  })

  it('is false for min = max = 1 (plain host, spec User Story 4 scenario 1)', () => {
    expect(shouldRenderScalingGroup({ minReplicas: 1, maxReplicas: 1 })).toBe(false)
  })

  it('is true whenever scaling is actually possible', () => {
    expect(shouldRenderScalingGroup({ minReplicas: 1, maxReplicas: 4 })).toBe(true)
    expect(shouldRenderScalingGroup({ minReplicas: 3, maxReplicas: 3 })).toBe(true)
  })
})

describe('resolveReplicaTelemetry', () => {
  it('falls back to a static minReplicas snapshot before any metrics window exists', () => {
    const resolved = resolveReplicaTelemetry({ minReplicas: 2, maxReplicas: 4 }, undefined)
    expect(resolved).toEqual({ nominalCount: 2, bootingCount: 0, effectiveCount: 2, perReplicaSaturation: 0, events: [] })
  })

  it('passes live telemetry straight through once a metrics window exists', () => {
    const live: HostReplicaTelemetry = { nominalCount: 3, bootingCount: 1, effectiveCount: 2, perReplicaSaturation: 0.5, events: [] }
    expect(resolveReplicaTelemetry({ minReplicas: 1, maxReplicas: 4 }, live)).toBe(live)
  })
})
