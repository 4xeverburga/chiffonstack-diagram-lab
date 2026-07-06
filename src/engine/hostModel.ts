// Host saturation/latency model (research.md D2/D3/D6). Pure functions —
// no engine state — so every operating point is directly unit-testable
// (constitution VI) without exercising the whole simulation loop.

import { HOST_RHO_CLAMP, HOST_SATURATION_THRESHOLD, HOST_ZERO_CAPACITY_EPSILON } from './config'
import type { HostNodeMetrics, HostNodeSim } from './ports'

/** Inputs a per-window flow pass (flowPropagation.ts) must supply beyond
 *  the host's own static config. */
export interface HostComputeInput {
  sim: Extract<HostNodeSim, { profile: 'transactional_api' | 'worker_consumer' | 'database_server' }>
  incomingRPS: number
  /** Traffic-weighted mean of inbound edges' targetComputeWeightMultiplier
   *  (calculated mode only; research.md D3). */
  inboundWeightedComputeMultiplier: number
  /** Traffic-weighted mean of outbound edges' pathIoLatencyMs (calculated
   *  mode only; research.md D3). */
  outboundWeightedIoLatencyMs: number
}

// The M/M/1 residence-time-scaling hockey stick (research.md D2): applied
// continuously from ρ=0, no threshold gate. rho is clamped to
// HOST_RHO_CLAMP before it ever reaches this formula so the curve never
// divides by (1 - 1) = 0.
export function hockeyStickLatencyMs(baseLatencyMs: number, rho: number): number {
  const clamped = Math.min(Math.max(rho, 0), HOST_RHO_CLAMP)
  return baseLatencyMs * (1 + clamped / (1 - clamped))
}

function deriveStatus(rho: number, incomingRPS: number, hardCapRPS: number | undefined): HostNodeMetrics['status'] {
  const offeredLoadExceedsCap = hardCapRPS !== undefined && incomingRPS > hardCapRPS
  if (offeredLoadExceedsCap || rho >= 1) return 'overloaded'
  if (rho >= HOST_SATURATION_THRESHOLD) return 'saturated'
  return 'healthy'
}

/** client_pool: a traffic source, not a saturating host — it emits its
 *  configured rate and never itself saturates. */
export function computeClientPoolMetrics(requestRatePerSec: number): HostNodeMetrics {
  const rate = Math.max(0, requestRatePerSec)
  return {
    incomingRPS: 0,
    forwardedRPS: rate,
    shedRPS: 0,
    saturationRatio: 0,
    latencyMs: 0,
    status: 'healthy',
  }
}

/** external_api: bottomless — ρ=0 always, forwards everything, never sheds
 *  (research.md summary of D2/D6 applied to this profile). */
export function computeExternalApiMetrics(incomingRPS: number, manualBaselineLatencyMs: number): HostNodeMetrics {
  const incoming = Math.max(0, incomingRPS)
  return {
    incomingRPS: incoming,
    forwardedRPS: incoming,
    shedRPS: 0,
    saturationRatio: 0,
    latencyMs: Math.max(0, manualBaselineLatencyMs),
    status: 'healthy',
  }
}

/** Manual mode (research.md D3/D6): ρ = incomingRPS / manualSaturationRPS;
 *  forwardedRPS hard-clamped at manualMaxRPS, the remainder shed. */
function computeManualMetrics(
  sim: Extract<HostNodeSim, { configMode: 'manual' }>,
  incomingRPS: number,
): HostNodeMetrics {
  const incoming = Math.max(0, incomingRPS)
  const saturationCapacity = Math.max(0, sim.manualSaturationRPS)
  const rho = saturationCapacity > 0 ? incoming / saturationCapacity : 0
  const maxRPS = Math.max(0, sim.manualMaxRPS)
  const forwardedRPS = Math.min(incoming, maxRPS)
  const shedRPS = Math.max(0, incoming - forwardedRPS)
  return {
    incomingRPS: incoming,
    forwardedRPS,
    shedRPS,
    saturationRatio: rho,
    latencyMs: hockeyStickLatencyMs(Math.max(0, sim.manualBaselineLatencyMs), rho),
    status: deriveStatus(rho, incoming, maxRPS),
  }
}

/** Calculated mode (research.md D3): capacityRPS = maxWorkerThreads /
 *  (cpuProcessingTimeMs / 1000); ρ weighted by the traffic-weighted mean
 *  inbound compute multiplier; base latency = cpuProcessingTimeMs plus the
 *  traffic-weighted mean outbound pathIoLatencyMs. No maxRPS parameter
 *  exists in this mode, so nothing is ever shed. */
function computeCalculatedMetrics(
  sim: Extract<HostNodeSim, { configMode: 'calculated' }>,
  incomingRPS: number,
  inboundWeightedComputeMultiplier: number,
  outboundWeightedIoLatencyMs: number,
): HostNodeMetrics {
  const incoming = Math.max(0, incomingRPS)
  const threads = Math.max(0, sim.maxWorkerThreads)
  const cpuTimeSec = Math.max(0, sim.cpuProcessingTimeMs) / 1000
  const capacityRPS = threads > 0 && cpuTimeSec > 0 ? threads / cpuTimeSec : 0
  const weight = Math.max(0, inboundWeightedComputeMultiplier)
  const rho = threads > 0 ? (incoming * weight * cpuTimeSec) / threads : incoming > 0 ? incoming / HOST_ZERO_CAPACITY_EPSILON : 0
  const baseLatencyMs = Math.max(0, sim.cpuProcessingTimeMs) + Math.max(0, outboundWeightedIoLatencyMs)
  void capacityRPS
  return {
    incomingRPS: incoming,
    forwardedRPS: incoming,
    shedRPS: 0,
    saturationRatio: rho,
    latencyMs: hockeyStickLatencyMs(baseLatencyMs, rho),
    status: deriveStatus(rho, incoming, undefined),
  }
}

/** capacityRPS for a calculated-mode host at weight-1.0 traffic
 *  (research.md D3) — exposed separately for the formula catalog and the
 *  Inspector's calculated-mode summary. */
export function calculatedCapacityRPS(cpuProcessingTimeMs: number, maxWorkerThreads: number): number {
  const threads = Math.max(0, maxWorkerThreads)
  const cpuTimeSec = Math.max(0, cpuProcessingTimeMs) / 1000
  return threads > 0 && cpuTimeSec > 0 ? threads / cpuTimeSec : 0
}

export function computeHostMetrics(input: HostComputeInput): HostNodeMetrics {
  const { sim, incomingRPS, inboundWeightedComputeMultiplier, outboundWeightedIoLatencyMs } = input
  if (sim.configMode === 'manual') return computeManualMetrics(sim, incomingRPS)
  return computeCalculatedMetrics(sim, incomingRPS, inboundWeightedComputeMultiplier, outboundWeightedIoLatencyMs)
}
