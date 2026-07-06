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
// duration clamped to [0.2s, 6s], dash density to [0, 1]. Log-scaled input
// so 10 req/s vs 1,000 req/s vs 100,000 req/s remain visually distinguishable.
// x0=1 (curve midpoint at throughput ~9 req/s, since x0 is on a
// log10(throughput+1) scale) so realistic test/demo rates (10-1,000 req/s)
// spread across most of the curve instead of clustering near the slow end
// — with the old x0=2 (midpoint ~99 req/s), 1,000 req/s only reached
// ~1.4s, nowhere near the fast floor; you needed ~10,000-100,000 req/s to
// really saturate it. k=3 (steeper than the original 1.5) so crossing one
// order of magnitude above x0 ramps most of the way to saturated rather
// than needing two-plus orders of magnitude — with k=1.5, 10x the midpoint
// rate only reached ~1.25s, still reading as "not much faster"; with k=3,
// 10x the midpoint reaches ~0.47s (close to the fast floor), which matches
// the intent of the traffic-scale dropdown below: "10x my typical rate"
// should look clearly saturated, not just a little quicker. Measured with
// this config (x0=1, k=3): 1 req/s ~5.4s, 10 req/s ~2.9s, 100 req/s
// ~0.47s, 1,000 req/s ~0.21s (near the 0.2s floor). durationMinSec itself
// was also lowered from 0.4s to 0.2s (raising the top speed the animation
// can ever reach) — not lower than that, to avoid the loop reading as a
// flicker/strobe rather than motion.
export const DEFAULT_SIGMOID_MAPPING_CONFIG: SigmoidMappingConfig = {
  durationMaxSec: 0.6,
  durationMinSec: 0.1,
  densityMin: 0,
  densityMax: 1,
  k: 8,
  x0: 1,
}

// User-facing "what's normal for my architecture?" selector (SimulationControls'
// traffic-scale dropdown). The sigmoid's only architecture-dependent knob is
// x0 (the curve's midpoint, on a log10(throughput+1) scale) — everything
// else about the animation's bounds stays identical across scales. Each
// step shifts x0 by exactly one order of magnitude, so "one size up" always
// means "the midpoint is 10x the req/s". A dashboard fronting a few hundred
// req/s and one fronting hundreds of thousands both deserve the visual
// range [durationMinSec, durationMaxSec] to represent *their own* "slow" to
// "saturated" — there's no single x0 that's correct for every architecture.
export type TrafficScale = 'small' | 'medium' | 'large' | 'very-large'

export const TRAFFIC_SCALE_LABELS: Record<TrafficScale, string> = {
  small: 'Small (~10s req/s)',
  medium: 'Medium (~100s req/s)',
  large: 'Large (~1,000s req/s)',
  'very-large': 'Very large (~10,000s req/s)',
}

export const SIGMOID_MAPPING_BY_TRAFFIC_SCALE: Record<TrafficScale, SigmoidMappingConfig> = {
  small: DEFAULT_SIGMOID_MAPPING_CONFIG,
  medium: { ...DEFAULT_SIGMOID_MAPPING_CONFIG, x0: 2 },
  large: { ...DEFAULT_SIGMOID_MAPPING_CONFIG, x0: 3 },
  'very-large': { ...DEFAULT_SIGMOID_MAPPING_CONFIG, x0: 4 },
}

export const DEFAULT_TRAFFIC_SCALE: TrafficScale = 'small'

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

// Host/queue/edge simulation model constants (feature 011). Single source
// of truth for every tunable the host saturation curve, queue backlog
// integration, and edge congestion treatment read from (CLAUDE.md).

// ρ is clamped below 1 before it ever reaches the hockey-stick latency
// curve (research.md D2) — division by (1 - rho) would otherwise explode
// to Infinity exactly at saturation, violating the "every emitted number
// is finite" contract (contracts/engine-ports.md guarantee 4).
export const HOST_RHO_CLAMP = 0.99

// A host's status becomes 'saturated' once ρ crosses this fraction of its
// capacity (data-model.md HostNodeMetrics status derivation).
export const HOST_SATURATION_THRESHOLD = 0.85

// An edge is flagged congested once its target host's saturation ratio
// crosses this threshold (data-model.md EdgeSimMetrics.isCongested).
export const EDGE_CONGESTION_THRESHOLD = 0.85

// Floor substituted for a host's own capacity denominator when computing
// ρ if that capacity is configured to exactly zero — keeps ρ a finite
// number (proportional to offered load) instead of dividing by zero,
// without ever producing NaN/Infinity (research.md D2/D6, "zero-capacity
// inputs yield zeros, never NaN").
export const HOST_ZERO_CAPACITY_EPSILON = 1e-6

// RPS <-> MB/s <-> GB/s unit conversions (data-model.md QueueNodeMetrics/
// EdgeSimMetrics), kept centralized rather than re-declared per module.
export const BYTES_PER_KB = 1024
export const KB_PER_MB = 1024
export const MB_PER_GB = 1024
