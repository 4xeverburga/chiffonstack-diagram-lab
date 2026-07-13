// Smooths a live edge's throughput reading before it drives HeatEdge's CSS
// animation speed (constitution Principle V: every animated value must stay
// bounded and deterministic). Raw per-window throughput is Poisson-noisy —
// at low rates a 200ms window sees only a handful of arrivals, so its
// relative variance is high and feeding it straight into `animation-duration`
// reads as visual jitter. This module bounds the *rate of visual change*
// too: the displayed animation only steps when the live rate has genuinely
// drifted away from its recent baseline, and never more often than once
// every `holdMs`.
//
// Two-timescale exponential-moving-average design — no history array:
//   - a fast EMA tracks the live throughput itself (smooths per-window
//     Poisson noise without lagging real rate changes for long)
//   - a slow EMA + an exponentially-weighted variance track a rolling
//     baseline mean/std-dev for that fast EMA (the "last few seconds
//     average" the live rate is judged against)
// The committed (visually displayed) animation only changes when the fast
// EMA deviates from the baseline by more than `sigmaThreshold` standard
// deviations AND at least `holdMs` has elapsed since the last change.
//
// The module itself holds no state: `updateFlowAnimationState` is a pure
// function from (previous state, new sample) to (next state), so it's
// trivially unit-testable with fixed timestamps. It's the caller's job
// (one instance per edge) to thread the returned value into the next call.

import { mapThroughputToAnimation, type AnimationParams, type SigmoidMappingConfig } from './sigmoidMapping'

export interface FlowSmoothingConfig {
  /** Time constant for the fast EMA that tracks live throughput (ms). */
  fastTauMs: number
  /** Time constant for the slow EMA/variance baseline (ms) — the
   *  "recent average" the fast EMA is compared against. */
  slowTauMs: number
  /** Minimum real time between two committed animation changes (ms). */
  holdMs: number
  /** How many baseline standard deviations away from the baseline mean
   *  the fast EMA must be before a change is even considered. */
  sigmaThreshold: number
  /** Floor under the baseline standard deviation (req/s), so a
   *  momentarily near-zero-variance signal can't make a tiny wobble
   *  read as "significant". */
  minStdDevFloor: number
}

// The default time constants/thresholds live in ./config.ts
// (DEFAULT_FLOW_SMOOTHING_CONFIG) alongside every other simulation-tunable
// parameter.

export interface FlowAnimationState {
  emaThroughputPerSec: number
  baselineMeanPerSec: number
  baselineVariance: number
  committed: AnimationParams
  lastCommitAtMs: number
  lastSampleAtMs: number
}

export function createInitialFlowAnimationState(mappingConfig: SigmoidMappingConfig): FlowAnimationState {
  return {
    emaThroughputPerSec: 0,
    baselineMeanPerSec: 0,
    baselineVariance: 0,
    committed: mapThroughputToAnimation(0, mappingConfig),
    lastCommitAtMs: -Infinity,
    lastSampleAtMs: -Infinity,
  }
}

// alpha -> 1 when deltaMs is unbounded (i.e. the very first sample), so a
// brand-new state snaps straight to that first reading instead of easing up
// from zero.
function emaAlpha(deltaMs: number, tauMs: number): number {
  if (!Number.isFinite(deltaMs)) return 1
  return 1 - Math.exp(-deltaMs / tauMs)
}

export function updateFlowAnimationState(
  prev: FlowAnimationState,
  rawThroughputPerSec: number,
  nowMs: number,
  smoothingConfig: FlowSmoothingConfig,
  mappingConfig: SigmoidMappingConfig,
): FlowAnimationState {
  const isFirstSample = !Number.isFinite(prev.lastSampleAtMs)
  const deltaMs = nowMs - prev.lastSampleAtMs

  const fastAlpha = emaAlpha(deltaMs, smoothingConfig.fastTauMs)
  const emaThroughputPerSec = prev.emaThroughputPerSec + fastAlpha * (rawThroughputPerSec - prev.emaThroughputPerSec)

  const slowAlpha = emaAlpha(deltaMs, smoothingConfig.slowTauMs)
  const baselineMeanPerSec = prev.baselineMeanPerSec + slowAlpha * (emaThroughputPerSec - prev.baselineMeanPerSec)
  const deviation = emaThroughputPerSec - baselineMeanPerSec
  const baselineVariance = prev.baselineVariance + slowAlpha * (deviation * deviation - prev.baselineVariance)

  const baselineStdDev = Math.max(Math.sqrt(baselineVariance), smoothingConfig.minStdDevFloor)
  const isSignificant = Math.abs(deviation) > smoothingConfig.sigmaThreshold * baselineStdDev
  const holdElapsed = nowMs - prev.lastCommitAtMs >= smoothingConfig.holdMs
  const shouldCommit = isFirstSample || (isSignificant && holdElapsed)

  return {
    emaThroughputPerSec,
    baselineMeanPerSec,
    baselineVariance,
    committed: shouldCommit ? mapThroughputToAnimation(emaThroughputPerSec, mappingConfig) : prev.committed,
    lastCommitAtMs: shouldCommit ? nowMs : prev.lastCommitAtMs,
    lastSampleAtMs: nowMs,
  }
}
