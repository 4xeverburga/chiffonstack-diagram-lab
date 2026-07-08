// Pure ring-buffer state for HostSaturationSparkline.tsx's always-on
// saturation gauge (see that file's header for the full rationale: an
// always-rendered widget so the node's own footprint never changes
// between idle/editing and any running simulation state). Kept as an
// immutable-state pure module (mirrors flowAnimationSmoothing.ts's split:
// this file holds no state itself, `pushSparklineSample` is a pure
// function from (previous state, new sample) to (next state)) so it's
// trivially unit-testable without mounting React (constitution VI), and so
// HostSaturationSparkline.tsx can thread it through a useRef exactly like
// HeatEdge.tsx threads FlowAnimationState. Generic over what's being
// tracked (a plain number ring buffer) — nothing here is saturation-
// specific, so this module needed no changes when the plotted value
// switched from forwardedRPS to saturationRatio.

export interface SparklineHistoryState {
  /** Oldest sample first; bounded to at most `maxLength` entries. */
  samples: number[]
}

export function createInitialSparklineHistory(): SparklineHistoryState {
  return { samples: [] }
}

// Appends one sample, trimming from the front once over maxLength — a
// plain FIFO ring buffer. `maxLength <= 0` degenerates to "no history kept"
// rather than throwing, since a misconfigured caller shouldn't crash the
// canvas over a cosmetic sparkline.
export function pushSparklineSample(state: SparklineHistoryState, value: number, maxLength: number): SparklineHistoryState {
  if (maxLength <= 0) return { samples: [] }
  const next = [...state.samples, value]
  return { samples: next.length > maxLength ? next.slice(next.length - maxLength) : next }
}
