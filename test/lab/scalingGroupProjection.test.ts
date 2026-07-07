import { describe, expect, it } from 'vitest'
import { isScalingGroupHost, projectScalingGroup } from '../../src/lab/scalingGroupProjection'
import type { HostReplicaTelemetry } from '../../src/engine/ports'

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

describe('projectScalingGroup — cap and overflow across a 1->6->1 sweep', () => {
  it('shows exactly nominalCount chips when at or below the visible cap', () => {
    for (const nominalCount of [1, 2, 3, 4]) {
      const projection = projectScalingGroup(telemetry({ nominalCount }), null)
      expect(projection.visibleChips).toHaveLength(nominalCount)
      expect(projection.overflowCount).toBe(0)
    }
  })

  it('caps visible chips at 4 and reports the correct overflow remainder above the cap', () => {
    const five = projectScalingGroup(telemetry({ nominalCount: 5 }), null)
    expect(five.visibleChips).toHaveLength(4)
    expect(five.overflowCount).toBe(1)

    const six = projectScalingGroup(telemetry({ nominalCount: 6 }), null)
    expect(six.visibleChips).toHaveLength(4)
    expect(six.overflowCount).toBe(2)
  })

  it('shrinks back to zero overflow once nominalCount drops back within the cap', () => {
    const scaledDown = projectScalingGroup(telemetry({ nominalCount: 1 }), null)
    expect(scaledDown.visibleChips).toHaveLength(1)
    expect(scaledDown.overflowCount).toBe(0)
  })
})

describe('projectScalingGroup — booting-chip flagging', () => {
  it('flags exactly the newest chips as booting, up to bootingCount', () => {
    const projection = projectScalingGroup(telemetry({ nominalCount: 3, bootingCount: 1 }), null)
    expect(projection.visibleChips.map((chip) => chip.booting)).toEqual([false, false, true])
  })

  it('never flags more chips than are actually visible', () => {
    const projection = projectScalingGroup(telemetry({ nominalCount: 6, bootingCount: 5 }), null)
    expect(projection.visibleChips).toHaveLength(4)
    expect(projection.visibleChips.filter((chip) => chip.booting)).toHaveLength(4)
  })

  it('flags zero chips when nothing is booting', () => {
    const projection = projectScalingGroup(telemetry({ nominalCount: 3, bootingCount: 0 }), null)
    expect(projection.visibleChips.every((chip) => !chip.booting)).toBe(true)
  })
})

describe('projectScalingGroup — determinism / count-change gating', () => {
  it('identical telemetry (deep-equal, not object identity) produces a deep-equal projection', () => {
    const a = projectScalingGroup(telemetry({ nominalCount: 3, bootingCount: 1 }), 'up')
    const b = projectScalingGroup(telemetry({ nominalCount: 3, bootingCount: 1 }), 'up')
    expect(a).toEqual(b)
  })

  it('passes the pulse argument straight through unchanged', () => {
    expect(projectScalingGroup(telemetry(), 'up').pulse).toBe('up')
    expect(projectScalingGroup(telemetry(), 'down').pulse).toBe('down')
    expect(projectScalingGroup(telemetry(), null).pulse).toBeNull()
  })
})

describe('projectScalingGroup — layout metrics', () => {
  it('grows groupHeightPx monotonically with visible chip count', () => {
    let previous = -1
    for (let nominalCount = 1; nominalCount <= 4; nominalCount += 1) {
      const projection = projectScalingGroup(telemetry({ nominalCount }), null)
      expect(projection.groupHeightPx).toBeGreaterThan(previous)
      previous = projection.groupHeightPx
    }
  })

  it('does not grow further once the visible cap is reached (overflow does not add height)', () => {
    const atCap = projectScalingGroup(telemetry({ nominalCount: 4 }), null)
    const overCap = projectScalingGroup(telemetry({ nominalCount: 8 }), null)
    expect(overCap.groupHeightPx).toBe(atCap.groupHeightPx)
  })
})
