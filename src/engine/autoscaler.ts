// Pure autoscaler policy for saturating host profiles (data-model.md
// ReplicaRuntime/"Scaler decision"; research.md D1/D2/D7). Every function
// here is a pure transform of explicit state — no engine-wide state lives
// in this module — so every operating point (sustain accumulation,
// watermark crossing, cooldown, boot-queue draining, bounds re-clamp) is
// directly unit-testable (constitution VI) and deterministic (FR-008).

import { AUTOSCALE_COOLDOWN_MS, AUTOSCALE_HIGH_WATERMARK, AUTOSCALE_LOW_WATERMARK, AUTOSCALE_SUSTAIN_MS, SCALING_EVENT_HISTORY_LIMIT } from './config'
import type { ScalingEvent } from './ports'

/** Per-host, cross-window scaler state (data-model.md). */
export interface ReplicaRuntime {
  /** Scaler-managed; initialized to minReplicas; always in [min, max]. */
  nominalCount: number
  /** FIFO of replicas added but not yet serving (research.md D2). */
  booting: { readyAtSimTimeMs: number }[]
  /** Sustain accumulators (research.md D1) — reset whenever saturation
   *  re-enters the hysteresis band. */
  timeAboveHighMs: number
  timeBelowLowMs: number
  /** Cooldown anchor; undefined until the first action ever fires. */
  lastActionSimTimeMs: number | undefined
  /** Bounded ring, most recent last. */
  events: ScalingEvent[]
}

/** Fresh runtime for a host at load/reset time (FR-014): starts serving at
 *  minReplicas with no booting entries, accumulators, or history. */
export function createReplicaRuntime(minReplicas: number): ReplicaRuntime {
  return {
    nominalCount: minReplicas,
    booting: [],
    timeAboveHighMs: 0,
    timeBelowLowMs: 0,
    lastActionSimTimeMs: undefined,
    events: [],
  }
}

/** Drains booting entries whose boot delay has elapsed by `simTimeMs` —
 *  called at the start of each window, before that window's host math
 *  runs (research.md D2), so a replica that just finished booting
 *  contributes capacity starting this window. */
export function drainBootQueue(runtime: ReplicaRuntime, simTimeMs: number): ReplicaRuntime {
  const stillBooting = runtime.booting.filter((entry) => entry.readyAtSimTimeMs > simTimeMs)
  if (stillBooting.length === runtime.booting.length) return runtime
  return { ...runtime, booting: stillBooting }
}

/** effectiveReplicas = nominalCount − booting.length (data-model.md) — the
 *  capacity divisor host math actually uses. Never below 1 in practice:
 *  the first replica of any host is created already serving and is never
 *  put in the booting queue. */
export function effectiveReplicas(runtime: ReplicaRuntime): number {
  return runtime.nominalCount - runtime.booting.length
}

function appendEvent(events: ScalingEvent[], event: ScalingEvent): ScalingEvent[] {
  const next = [...events, event]
  return next.length > SCALING_EVENT_HISTORY_LIMIT ? next.slice(next.length - SCALING_EVENT_HISTORY_LIMIT) : next
}

function cooldownElapsed(runtime: ReplicaRuntime, simTimeMs: number): boolean {
  return runtime.lastActionSimTimeMs === undefined || simTimeMs - runtime.lastActionSimTimeMs >= AUTOSCALE_COOLDOWN_MS
}

export interface ScalingDecisionInput {
  /** Runtime AFTER this window's drainBootQueue call. */
  runtime: ReplicaRuntime
  /** This window's per-replica saturation ratio (already computed from
   *  the effective count post-drain). */
  perReplicaSaturation: number
  simTimeMs: number
  windowSizeMs: number
  minReplicas: number
  maxReplicas: number
  /** User-declared capability parameter (feature 013, promoted from an
   *  internal tunable — constitution v3.2.0): simulated ms a newly-added
   *  replica takes before it serves traffic. */
  bootDelayMs: number
}

export interface ScalingDecisionOutput {
  /** Runtime to carry into the NEXT window's drainBootQueue call. */
  runtime: ReplicaRuntime
  event: ScalingEvent | undefined
}

/** One deterministic per-window scaler evaluation (data-model.md "Scaler
 *  decision", research.md D1):
 *  - saturation ≥ HIGH for ≥ SUSTAIN, count < max, cooldown elapsed → up
 *    by 1 (queues a boot entry; effective capacity is unchanged this
 *    window — spec FR-006/US1 scenario 2).
 *  - saturation ≤ LOW for ≥ SUSTAIN, count > min, cooldown elapsed → down
 *    by 1 (cancels the newest booting entry first if one exists, otherwise
 *    removes a serving replica; nominalCount drops immediately, but the
 *    capacity DIVISOR this window was already fixed before this decision
 *    ran, so the drop in served capacity is only visible starting next
 *    window — spec US2 scenario 1).
 *  - otherwise → hold; entering the band resets both accumulators. */
export function evaluateScaling(input: ScalingDecisionInput): ScalingDecisionOutput {
  const { perReplicaSaturation, simTimeMs, windowSizeMs, minReplicas, maxReplicas, bootDelayMs } = input
  let runtime = input.runtime

  if (perReplicaSaturation >= AUTOSCALE_HIGH_WATERMARK) {
    runtime = { ...runtime, timeAboveHighMs: runtime.timeAboveHighMs + windowSizeMs, timeBelowLowMs: 0 }
  } else if (perReplicaSaturation <= AUTOSCALE_LOW_WATERMARK) {
    runtime = { ...runtime, timeBelowLowMs: runtime.timeBelowLowMs + windowSizeMs, timeAboveHighMs: 0 }
  } else {
    runtime = { ...runtime, timeAboveHighMs: 0, timeBelowLowMs: 0 }
  }

  if (runtime.timeAboveHighMs >= AUTOSCALE_SUSTAIN_MS && runtime.nominalCount < maxReplicas && cooldownElapsed(runtime, simTimeMs)) {
    const newCount = runtime.nominalCount + 1
    const event: ScalingEvent = { direction: 'up', newCount, simTimeMs }
    return {
      runtime: {
        ...runtime,
        nominalCount: newCount,
        booting: [...runtime.booting, { readyAtSimTimeMs: simTimeMs + bootDelayMs }],
        timeAboveHighMs: 0,
        timeBelowLowMs: 0,
        lastActionSimTimeMs: simTimeMs,
        events: appendEvent(runtime.events, event),
      },
      event,
    }
  }

  if (runtime.timeBelowLowMs >= AUTOSCALE_SUSTAIN_MS && runtime.nominalCount > minReplicas && cooldownElapsed(runtime, simTimeMs)) {
    const newCount = runtime.nominalCount - 1
    const event: ScalingEvent = { direction: 'down', newCount, simTimeMs }
    const booting = runtime.booting.length > 0 ? runtime.booting.slice(0, -1) : runtime.booting
    return {
      runtime: {
        ...runtime,
        nominalCount: newCount,
        booting,
        timeAboveHighMs: 0,
        timeBelowLowMs: 0,
        lastActionSimTimeMs: simTimeMs,
        events: appendEvent(runtime.events, event),
      },
      event,
    }
  }

  return { runtime, event: undefined }
}

/** Mid-run bounds edit (research.md D7, spec edge case): re-clamp
 *  nominalCount into the new [min, max] and cancel booting entries beyond
 *  the new max (newest first); accumulators/cooldown are preserved. */
export function reclampReplicaRuntime(runtime: ReplicaRuntime, minReplicas: number, maxReplicas: number): ReplicaRuntime {
  const clampedNominal = Math.min(Math.max(runtime.nominalCount, minReplicas), maxReplicas)
  if (clampedNominal === runtime.nominalCount) return runtime
  const removed = runtime.nominalCount - clampedNominal
  const booting = removed > 0 ? runtime.booting.slice(0, Math.max(0, runtime.booting.length - removed)) : runtime.booting
  return { ...runtime, nominalCount: clampedNominal, booting }
}
