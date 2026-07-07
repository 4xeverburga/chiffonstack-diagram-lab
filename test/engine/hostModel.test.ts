import { describe, expect, it } from 'vitest'
import {
  calculatedCapacityRPS,
  computeClientPoolMetrics,
  computeExternalApiMetrics,
  computeHostMetrics,
  hockeyStickLatencyMs,
} from '../../src/engine/hostModel'
import { HOST_RHO_CLAMP } from '../../src/engine/config'
import type { HostNodeSim } from '../../src/engine/ports'

function manualSim(overrides: Partial<Extract<HostNodeSim, { configMode: 'manual' }>> = {}) {
  return {
    kind: 'host' as const,
    profile: 'transactional_api' as const,
    configMode: 'manual' as const,
    manualBaselineLatencyMs: 10,
    manualSaturationRPS: 500,
    manualMaxRPS: 550,
    minReplicas: 1,
    maxReplicas: 1,
    bootDelayMs: 8000,
    ...overrides,
  }
}

function calculatedSim(overrides: Partial<Extract<HostNodeSim, { configMode: 'calculated' }>> = {}) {
  return {
    kind: 'host' as const,
    profile: 'transactional_api' as const,
    configMode: 'calculated' as const,
    cpuProcessingTimeMs: 16,
    maxWorkerThreads: 8,
    minReplicas: 1,
    maxReplicas: 1,
    bootDelayMs: 8000,
    ...overrides,
  }
}

describe('hockeyStickLatencyMs', () => {
  it('stays near baseline at low utilization (rho=0.2)', () => {
    expect(hockeyStickLatencyMs(10, 0.2)).toBeCloseTo(12.5, 5)
  })

  it('is at least 5x baseline at rho=0.95 (SC-002)', () => {
    expect(hockeyStickLatencyMs(10, 0.95)).toBeGreaterThanOrEqual(50)
  })

  it('clamps rho below 1 so it never divides by zero / returns Infinity', () => {
    expect(Number.isFinite(hockeyStickLatencyMs(10, 1))).toBe(true)
    expect(Number.isFinite(hockeyStickLatencyMs(10, 5))).toBe(true)
  })

  it('increases strictly monotonically across a 10%->99% sweep with no discontinuity', () => {
    let previous = hockeyStickLatencyMs(10, 0.1)
    for (let rho = 0.11; rho <= 0.99; rho += 0.01) {
      const current = hockeyStickLatencyMs(10, rho)
      expect(current).toBeGreaterThan(previous)
      previous = current
    }
  })
})

describe('computeHostMetrics — manual mode', () => {
  it('reports near-baseline latency and low saturation under light load', () => {
    const metrics = computeHostMetrics({
      sim: manualSim(),
      incomingRPS: 100,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    expect(metrics.saturationRatio).toBeCloseTo(0.2, 5)
    expect(metrics.latencyMs).toBeCloseTo(hockeyStickLatencyMs(10, 0.2), 5)
    expect(metrics.status).toBe('healthy')
  })

  it('forwards everything and sheds nothing below manualMaxRPS', () => {
    const metrics = computeHostMetrics({
      sim: manualSim(),
      incomingRPS: 400,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    expect(metrics.forwardedRPS).toBe(400)
    expect(metrics.shedRPS).toBe(0)
  })

  it('hard-clamps forwardedRPS at manualMaxRPS and sheds the remainder (research.md D6)', () => {
    const metrics = computeHostMetrics({
      sim: manualSim(),
      incomingRPS: 700,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    expect(metrics.forwardedRPS).toBe(550)
    expect(metrics.shedRPS).toBe(150)
    expect(metrics.status).toBe('overloaded')
    expect(Number.isFinite(metrics.latencyMs)).toBe(true)
  })

  it('marks saturated once rho crosses the saturation threshold but stays under manualMaxRPS', () => {
    const metrics = computeHostMetrics({
      sim: manualSim(),
      incomingRPS: 460,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    expect(metrics.status).toBe('saturated')
    expect(metrics.shedRPS).toBe(0)
  })

  it('zero-capacity manual host (0 saturation/max RPS) yields zero forwarded/shed and finite latency, never NaN', () => {
    const metrics = computeHostMetrics({
      sim: manualSim({ manualSaturationRPS: 0, manualMaxRPS: 0 }),
      incomingRPS: 100,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    expect(metrics.forwardedRPS).toBe(0)
    expect(metrics.shedRPS).toBe(100)
    expect(Number.isFinite(metrics.latencyMs)).toBe(true)
    expect(Number.isNaN(metrics.saturationRatio)).toBe(false)
  })
})

describe('computeHostMetrics — calculated mode (research.md D3)', () => {
  it('matches manual mode within 1% at an equivalent operating point (SC-003)', () => {
    // 16ms * 8 threads => 500 req/s capacity, same as the manual fixture's
    // manualSaturationRPS; baseline latency is also aligned to 16ms so the
    // two modes represent the exact same underlying service, isolating the
    // comparison to ρ/latency-curve agreement rather than an arbitrary
    // difference between independently-chosen baseline latency inputs.
    const manual = computeHostMetrics({
      sim: manualSim({ manualBaselineLatencyMs: 16 }),
      incomingRPS: 400,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    const calculated = computeHostMetrics({
      sim: calculatedSim(),
      incomingRPS: 400,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    expect(calculated.saturationRatio).toBeCloseTo(manual.saturationRatio, 5)
    const relativeLatencyDiff = Math.abs(calculated.latencyMs - manual.latencyMs) / manual.latencyMs
    expect(relativeLatencyDiff).toBeLessThan(0.01)
  })

  it('scales rho proportionally to the inbound weighted compute multiplier', () => {
    const base = computeHostMetrics({
      sim: calculatedSim(),
      incomingRPS: 200,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    const doubled = computeHostMetrics({
      sim: calculatedSim(),
      incomingRPS: 200,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 2,
      outboundWeightedIoLatencyMs: 0,
    })
    expect(doubled.saturationRatio).toBeCloseTo(base.saturationRatio * 2, 5)
  })

  it('composes base latency from cpuProcessingTimeMs plus the outbound weighted I/O latency', () => {
    const withIo = computeHostMetrics({
      sim: calculatedSim(),
      incomingRPS: 0,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 5,
    })
    // At incomingRPS=0, rho=0, so latencyMs === baseLatencyMs exactly.
    expect(withIo.latencyMs).toBeCloseTo(16 + 5, 5)
  })

  it('never sheds traffic (no maxRPS parameter exists in calculated mode)', () => {
    const metrics = computeHostMetrics({
      sim: calculatedSim(),
      incomingRPS: 5000,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    expect(metrics.forwardedRPS).toBe(5000)
    expect(metrics.shedRPS).toBe(0)
    expect(metrics.status).toBe('overloaded')
  })

  it('0-thread edge case yields finite numbers, never NaN/Infinity', () => {
    const metrics = computeHostMetrics({
      sim: calculatedSim({ maxWorkerThreads: 0 }),
      incomingRPS: 100,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    expect(Number.isFinite(metrics.saturationRatio)).toBe(true)
    expect(Number.isFinite(metrics.latencyMs)).toBe(true)
    expect(metrics.status).toBe('overloaded')
  })
})

describe('calculatedCapacityRPS', () => {
  it('computes threads / serviceTimeSec', () => {
    expect(calculatedCapacityRPS(16, 8)).toBeCloseTo(500, 5)
  })

  it('returns 0 for zero threads or zero cpu time, never NaN', () => {
    expect(calculatedCapacityRPS(0, 8)).toBe(0)
    expect(calculatedCapacityRPS(16, 0)).toBe(0)
  })
})

describe('computeClientPoolMetrics', () => {
  it('emits the configured rate as forwardedRPS and never saturates', () => {
    const metrics = computeClientPoolMetrics(250)
    expect(metrics.forwardedRPS).toBe(250)
    expect(metrics.saturationRatio).toBe(0)
    expect(metrics.status).toBe('healthy')
  })
})

describe('computeExternalApiMetrics', () => {
  it('is bottomless: rho=0, forwards everything, never sheds', () => {
    const metrics = computeExternalApiMetrics(10_000, 40)
    expect(metrics.saturationRatio).toBe(0)
    expect(metrics.forwardedRPS).toBe(10_000)
    expect(metrics.shedRPS).toBe(0)
    expect(metrics.latencyMs).toBe(40)
    expect(metrics.status).toBe('healthy')
  })
})

describe('HOST_RHO_CLAMP sanity', () => {
  it('is strictly below 1', () => {
    expect(HOST_RHO_CLAMP).toBeLessThan(1)
    expect(HOST_RHO_CLAMP).toBeGreaterThan(0)
  })
})

describe('computeHostMetrics — per-replica division (feature 013, research.md D3)', () => {
  it('effectiveReplicas=1 is bit-identical to the single-instance computation (SC-003)', () => {
    const single = computeHostMetrics({
      sim: manualSim(),
      incomingRPS: 400,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    expect(single.saturationRatio).toBeCloseTo(0.8, 5)
    expect(single.forwardedRPS).toBe(400)
  })

  it('divides incomingRPS by effectiveReplicas before computing rho/latency, then scales forwarded/shed back up', () => {
    // 4 replicas at 400 total => 100 per replica => rho = 100/500 = 0.2,
    // identical to the single-replica 100-req/s fixture above.
    const scaled = computeHostMetrics({
      sim: manualSim(),
      incomingRPS: 400,
      effectiveReplicas: 4,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    expect(scaled.saturationRatio).toBeCloseTo(0.2, 5)
    expect(scaled.latencyMs).toBeCloseTo(hockeyStickLatencyMs(10, 0.2), 5)
    expect(scaled.forwardedRPS).toBeCloseTo(400, 5)
    expect(scaled.shedRPS).toBe(0)
  })

  it('composes the per-replica manualMaxRPS clamp into a total cap of effectiveReplicas x manualMaxRPS (FR-003/FR-011)', () => {
    // 3 replicas, manualMaxRPS=550 each => total cap 1650; offered 2000 =>
    // 2000/3 ~= 666.7 per replica, clamped to 550 per replica, so shed
    // per replica ~= 116.7, scaled back up by 3.
    const metrics = computeHostMetrics({
      sim: manualSim(),
      incomingRPS: 2000,
      effectiveReplicas: 3,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    expect(metrics.forwardedRPS).toBeCloseTo(1650, 5)
    expect(metrics.shedRPS).toBeCloseTo(350, 5)
    expect(metrics.status).toBe('overloaded')
  })

  it('calculated mode also divides by effectiveReplicas (no shedding either way)', () => {
    const single = computeHostMetrics({
      sim: calculatedSim(),
      incomingRPS: 500,
      effectiveReplicas: 1,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    const scaled = computeHostMetrics({
      sim: calculatedSim(),
      incomingRPS: 500,
      effectiveReplicas: 5,
      inboundWeightedComputeMultiplier: 1,
      outboundWeightedIoLatencyMs: 0,
    })
    expect(scaled.saturationRatio).toBeCloseTo(single.saturationRatio / 5, 5)
    expect(scaled.forwardedRPS).toBeCloseTo(500, 5)
    expect(scaled.shedRPS).toBe(0)
  })
})
