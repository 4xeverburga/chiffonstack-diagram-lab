// Bounded logistic mapping from per-edge throughput onto HeatEdge's CSS
// animation variables (research.md D6, contracts data-model.md
// AnimationParams). Every animated value is bounded by construction
// (constitution Principle V) — no throughput, however large, can push the
// animation outside its fixed visual range.

export interface SigmoidMappingConfig {
  /** Animation-duration bound for near-zero throughput (slowest). */
  durationMaxSec: number
  /** Animation-duration bound for saturating throughput (fastest). */
  durationMinSec: number
  /** Dash-density bound for near-zero throughput (sparsest). */
  densityMin: number
  /** Dash-density bound for saturating throughput (densest). */
  densityMax: number
  /** Logistic steepness. */
  k: number
  /** Logistic midpoint, on a log10(throughput + 1) scale. */
  x0: number
}

export interface AnimationParams {
  durationSec: number
  dashDensity: number
}

// The default bounds/steepness live in ./config.ts (DEFAULT_SIGMOID_MAPPING_CONFIG)
// alongside every other simulation-tunable parameter.

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function logistic(x: number, k: number, x0: number): number {
  return 1 / (1 + Math.exp(-k * (x - x0)))
}

// V = V_min + (V_max - V_min) / (1 + e^(-k(log10(x) - x0))); throughput=0
// maps to t=0 (slowest/sparsest), arbitrarily large throughput saturates at
// t=1 (fastest/densest) — never beyond either bound.
export function mapThroughputToAnimation(throughputPerSec: number, config: SigmoidMappingConfig): AnimationParams {
  const safeThroughput = Math.max(throughputPerSec, 0)
  const logThroughput = Math.log10(safeThroughput + 1)
  const t = clamp(logistic(logThroughput, config.k, config.x0), 0, 1)
  const durationSec = config.durationMaxSec - t * (config.durationMaxSec - config.durationMinSec)
  const dashDensity = config.densityMin + t * (config.densityMax - config.densityMin)
  return {
    durationSec: clamp(durationSec, config.durationMinSec, config.durationMaxSec),
    dashDensity: clamp(dashDensity, config.densityMin, config.densityMax),
  }
}
