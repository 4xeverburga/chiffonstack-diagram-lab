// Centralized tunable parameters for the simulation engine and its
// animation-smoothing pipeline (CLAUDE.md: "centralize any parameter on a
// config file"). Every dial that shapes simulated/animated behavior lives
// here in one place instead of scattered across engine/sim modules, so
// tuning any of it means editing exactly one file.

import type { SigmoidMappingConfig } from './sigmoidMapping'
import type { FlowSmoothingConfig } from './flowAnimationSmoothing'

// The worker's tick cadence (simWorker.ts) and the engine's metrics
// aggregation window (useSimulation.ts) must always be the same value
// (research.md D5) — previously duplicated as two separately-hand-kept-in-
// sync constants, now a single source of truth.
export const SIM_TICK_MS = 200

// Fixed bounds for the shipped HeatEdge animation (research.md D6):
// duration clamped to [0.4s, 6s], dash density to [0, 1]. Log-scaled input
// so 10 req/s vs 1,000 req/s vs 100,000 req/s remain visually distinguishable.
export const DEFAULT_SIGMOID_MAPPING_CONFIG: SigmoidMappingConfig = {
  durationMaxSec: 6.0,
  durationMinSec: 0.4,
  densityMin: 0,
  densityMax: 1,
  k: 1.5,
  x0: 2,
}

// Two-timescale EMA + hysteresis/hold-time smoothing for HeatEdge's live
// animation speed (see flowAnimationSmoothing.ts for the full design
// rationale). fastTauMs smooths noise in the live reading before it's ever
// compared to the baseline or committed to the animation — 2000ms rather
// than a shorter constant because whatever value *does* get committed is
// read straight off this EMA at that instant, so it needs enough averaging
// to not itself be a noisy snapshot (this doesn't fully eliminate noise at
// very low request rates — see the note on distribution-agnosticism below
// — but keeps the committed value meaningfully steadier without adding
// real lag relative to the 3s hold). slowTauMs is the "recent average" the
// live reading is judged against — an EMA time constant of 20s means
// samples older than ~60s (3x the time constant) contribute under 5% of
// its weight, i.e. roughly "the last 20-60 seconds" rather than a hard
// window cutoff. holdMs is the minimum real time between two visible
// animation-speed changes; a change only commits once the live reading has
// drifted sigmaThreshold baseline standard deviations away from that
// recent average.
//
// Deliberately distribution-agnostic: nothing here assumes Poisson (or any
// other) arrival statistics. baselineVariance is an *empirical*,
// exponentially-weighted running variance computed from whatever samples
// actually arrive, so it self-calibrates to real traffic noise —
// including once this feeds off real load generators (e.g. JMeter/Locust)
// instead of the engine's synthetic Poisson source, whose burst/variance
// shape won't necessarily match a textbook distribution.
export const DEFAULT_FLOW_SMOOTHING_CONFIG: FlowSmoothingConfig = {
  fastTauMs: 2000,
  slowTauMs: 20000,
  holdMs: 3000,
  sigmaThreshold: 2,
  minStdDevFloor: 1,
}
