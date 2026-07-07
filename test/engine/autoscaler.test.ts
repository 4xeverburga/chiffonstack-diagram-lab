import { describe, expect, it } from 'vitest'
import {
  createReplicaRuntime,
  drainBootQueue,
  effectiveReplicas,
  evaluateScaling,
  reclampReplicaRuntime,
  type ReplicaRuntime,
} from '../../src/engine/autoscaler'
import {
  AUTOSCALE_COOLDOWN_MS,
  AUTOSCALE_HIGH_WATERMARK,
  AUTOSCALE_LOW_WATERMARK,
  AUTOSCALE_SUSTAIN_MS,
} from '../../src/engine/config'

const WINDOW_MS = 1000
const BOOT_DELAY_MS = 8000

function runWindows(
  runtime: ReplicaRuntime,
  saturations: number[],
  minReplicas: number,
  maxReplicas: number,
): { runtimes: ReplicaRuntime[]; events: (import('../../src/engine/ports').ScalingEvent | undefined)[] } {
  let current = runtime
  let simTimeMs = 0
  const runtimes: ReplicaRuntime[] = []
  const events: (import('../../src/engine/ports').ScalingEvent | undefined)[] = []
  for (const saturation of saturations) {
    simTimeMs += WINDOW_MS
    current = drainBootQueue(current, simTimeMs)
    const decision = evaluateScaling({
      runtime: current,
      perReplicaSaturation: saturation,
      simTimeMs,
      windowSizeMs: WINDOW_MS,
      minReplicas,
      maxReplicas,
      bootDelayMs: BOOT_DELAY_MS,
    })
    current = decision.runtime
    runtimes.push(current)
    events.push(decision.event)
  }
  return { runtimes, events }
}

describe('createReplicaRuntime', () => {
  it('starts at minReplicas with no booting entries, accumulators, or events', () => {
    const runtime = createReplicaRuntime(2)
    expect(runtime).toEqual({
      nominalCount: 2,
      booting: [],
      timeAboveHighMs: 0,
      timeBelowLowMs: 0,
      lastActionSimTimeMs: undefined,
      events: [],
    })
    expect(effectiveReplicas(runtime)).toBe(2)
  })
})

describe('evaluateScaling — scale-up half (US1)', () => {
  it('does not act on a transient spike shorter than the sustain window', () => {
    const runtime = createReplicaRuntime(1)
    const spikeWindows = Math.floor(AUTOSCALE_SUSTAIN_MS / WINDOW_MS) - 1
    const saturations = Array(spikeWindows).fill(AUTOSCALE_HIGH_WATERMARK + 0.05)
    const { runtimes, events } = runWindows(runtime, saturations, 1, 4)
    expect(events.every((event) => event === undefined)).toBe(true)
    expect(runtimes.at(-1)?.nominalCount).toBe(1)
  })

  it('fires exactly once sustain has been held for AUTOSCALE_SUSTAIN_MS, queuing a boot entry', () => {
    const runtime = createReplicaRuntime(1)
    const windowCount = Math.ceil(AUTOSCALE_SUSTAIN_MS / WINDOW_MS)
    const saturations = Array(windowCount).fill(AUTOSCALE_HIGH_WATERMARK + 0.05)
    const { runtimes, events } = runWindows(runtime, saturations, 1, 4)
    const fireIndex = events.findIndex((event) => event !== undefined)
    expect(fireIndex).toBeGreaterThanOrEqual(0)
    expect(events[fireIndex]).toEqual({ direction: 'up', newCount: 2, simTimeMs: (fireIndex + 1) * WINDOW_MS })
    expect(runtimes[fireIndex].nominalCount).toBe(2)
    expect(runtimes[fireIndex].booting).toHaveLength(1)
    // The boot entry's readyAt reflects the CONFIGURED bootDelayMs (feature
    // 013, promoted to a user-facing parameter in constitution v3.2.0), not
    // a hardcoded engine constant.
    expect(runtimes[fireIndex].booting[0].readyAtSimTimeMs).toBe((fireIndex + 1) * WINDOW_MS + BOOT_DELAY_MS)
    // Capacity unchanged until boot delay elapses (spec FR-006/US1 scenario 2).
    expect(effectiveReplicas(runtimes[fireIndex])).toBe(1)
  })

  it('a different bootDelayMs changes exactly when the booting replica starts serving (it is a real parameter, not a fixed constant)', () => {
    const fireAt = evaluateScaling({
      runtime: { ...createReplicaRuntime(1), timeAboveHighMs: AUTOSCALE_SUSTAIN_MS },
      perReplicaSaturation: AUTOSCALE_HIGH_WATERMARK + 0.05,
      simTimeMs: AUTOSCALE_SUSTAIN_MS,
      windowSizeMs: WINDOW_MS,
      minReplicas: 1,
      maxReplicas: 4,
      bootDelayMs: 2000,
    })
    expect(fireAt.runtime.booting[0].readyAtSimTimeMs).toBe(AUTOSCALE_SUSTAIN_MS + 2000)

    const slowBoot = evaluateScaling({
      runtime: { ...createReplicaRuntime(1), timeAboveHighMs: AUTOSCALE_SUSTAIN_MS },
      perReplicaSaturation: AUTOSCALE_HIGH_WATERMARK + 0.05,
      simTimeMs: AUTOSCALE_SUSTAIN_MS,
      windowSizeMs: WINDOW_MS,
      minReplicas: 1,
      maxReplicas: 4,
      bootDelayMs: 60_000,
    })
    expect(slowBoot.runtime.booting[0].readyAtSimTimeMs).toBe(AUTOSCALE_SUSTAIN_MS + 60_000)
  })

  it('respects cooldown: a second sustained high period right after the first does not fire again immediately', () => {
    const runtime = createReplicaRuntime(1)
    const windowCount = Math.ceil(AUTOSCALE_SUSTAIN_MS / WINDOW_MS) + Math.ceil(AUTOSCALE_COOLDOWN_MS / WINDOW_MS)
    const saturations = Array(windowCount).fill(AUTOSCALE_HIGH_WATERMARK + 0.05)
    const { events } = runWindows(runtime, saturations, 1, 4)
    const fireIndices = events.flatMap((event, index) => (event ? [index] : []))
    // Sustained the whole time, so once cooldown elapses it may fire again —
    // but never twice within one cooldown interval.
    for (let i = 1; i < fireIndices.length; i++) {
      const gapMs = (fireIndices[i] - fireIndices[i - 1]) * WINDOW_MS
      expect(gapMs).toBeGreaterThanOrEqual(AUTOSCALE_COOLDOWN_MS)
    }
  })

  it('never scales up past maxReplicas', () => {
    const runtime: ReplicaRuntime = { ...createReplicaRuntime(1), nominalCount: 4 }
    const windowCount = Math.ceil(AUTOSCALE_SUSTAIN_MS / WINDOW_MS) + 2
    const saturations = Array(windowCount).fill(1)
    const { runtimes, events } = runWindows(runtime, saturations, 1, 4)
    expect(events.every((event) => event === undefined)).toBe(true)
    expect(runtimes.at(-1)?.nominalCount).toBe(4)
  })

  it('drains a booting entry once simTimeMs reaches readyAtSimTimeMs, not before', () => {
    const runtime: ReplicaRuntime = {
      ...createReplicaRuntime(1),
      nominalCount: 2,
      booting: [{ readyAtSimTimeMs: 5000 }],
    }
    expect(effectiveReplicas(drainBootQueue(runtime, 4999))).toBe(1)
    expect(effectiveReplicas(drainBootQueue(runtime, 5000))).toBe(2)
  })

  it('is deterministic: the same saturation sequence twice yields identical event sequences', () => {
    const windowCount = Math.ceil(AUTOSCALE_SUSTAIN_MS / WINDOW_MS) + 5
    const saturations = Array(windowCount).fill(AUTOSCALE_HIGH_WATERMARK + 0.05)
    const first = runWindows(createReplicaRuntime(1), saturations, 1, 4)
    const second = runWindows(createReplicaRuntime(1), saturations, 1, 4)
    expect(first.events).toEqual(second.events)
    expect(first.runtimes.at(-1)).toEqual(second.runtimes.at(-1))
  })
})

describe('evaluateScaling — scale-down half (US2)', () => {
  it('steps down with at least the cooldown between actions, stopping at minReplicas', () => {
    const runtime: ReplicaRuntime = { ...createReplicaRuntime(1), nominalCount: 3 }
    const windowCount = 3 * (Math.ceil(AUTOSCALE_SUSTAIN_MS / WINDOW_MS) + Math.ceil(AUTOSCALE_COOLDOWN_MS / WINDOW_MS) + 1)
    const saturations = Array(windowCount).fill(AUTOSCALE_LOW_WATERMARK - 0.05)
    const { runtimes, events } = runWindows(runtime, saturations, 1, 3)
    const fireIndices = events.flatMap((event, index) => (event ? [index] : []))
    expect(fireIndices.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < fireIndices.length; i++) {
      const gapMs = (fireIndices[i] - fireIndices[i - 1]) * WINDOW_MS
      expect(gapMs).toBeGreaterThanOrEqual(AUTOSCALE_COOLDOWN_MS)
    }
    expect(runtimes.at(-1)?.nominalCount).toBe(1)
    expect(events.filter((event) => event?.direction === 'down')).toHaveLength(2)
  })

  it('holds inside the hysteresis band (no flapping across 3 consecutive evaluations at steady load, SC-002)', () => {
    const runtime = createReplicaRuntime(2)
    const bandSaturation = (AUTOSCALE_HIGH_WATERMARK + AUTOSCALE_LOW_WATERMARK) / 2
    const { runtimes, events } = runWindows(runtime, Array(3).fill(bandSaturation), 1, 4)
    expect(events.every((event) => event === undefined)).toBe(true)
    expect(runtimes.every((runtime) => runtime.nominalCount === 2)).toBe(true)
  })

  it('cancels the newest booting entry first before removing a serving replica', () => {
    const runtime: ReplicaRuntime = {
      ...createReplicaRuntime(1),
      nominalCount: 2,
      booting: [{ readyAtSimTimeMs: 999_999 }],
    }
    const windowCount = Math.ceil(AUTOSCALE_SUSTAIN_MS / WINDOW_MS)
    const saturations = Array(windowCount).fill(AUTOSCALE_LOW_WATERMARK - 0.05)
    const { runtimes, events } = runWindows(runtime, saturations, 1, 4)
    const fireIndex = events.findIndex((event) => event !== undefined)
    expect(events[fireIndex]?.direction).toBe('down')
    expect(runtimes[fireIndex].nominalCount).toBe(1)
    expect(runtimes[fireIndex].booting).toHaveLength(0)
  })

  it('never scales down past minReplicas', () => {
    const runtime = createReplicaRuntime(2)
    const windowCount = Math.ceil(AUTOSCALE_SUSTAIN_MS / WINDOW_MS) + 2
    const saturations = Array(windowCount).fill(0)
    const { runtimes, events } = runWindows(runtime, saturations, 2, 4)
    expect(events.every((event) => event === undefined)).toBe(true)
    expect(runtimes.at(-1)?.nominalCount).toBe(2)
  })
})

describe('reclampReplicaRuntime (research.md D7)', () => {
  it('clamps nominalCount down when maxReplicas shrinks below it, cancelling booting entries newest-first', () => {
    const runtime: ReplicaRuntime = {
      ...createReplicaRuntime(1),
      nominalCount: 4,
      booting: [{ readyAtSimTimeMs: 1000 }, { readyAtSimTimeMs: 2000 }],
    }
    const reclamped = reclampReplicaRuntime(runtime, 1, 2)
    expect(reclamped.nominalCount).toBe(2)
    expect(reclamped.booting).toHaveLength(0)
  })

  it('clamps nominalCount up when minReplicas rises above it', () => {
    const runtime = createReplicaRuntime(1)
    const reclamped = reclampReplicaRuntime(runtime, 3, 5)
    expect(reclamped.nominalCount).toBe(3)
  })

  it('is a no-op when already within bounds', () => {
    const runtime = createReplicaRuntime(2)
    expect(reclampReplicaRuntime(runtime, 1, 4)).toBe(runtime)
  })
})
