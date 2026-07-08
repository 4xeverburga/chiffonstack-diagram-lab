// Pure ring-buffer state for HostStatusSparkline.tsx's live "collapse
// curve" — the goodput trend line that replaced the sim-status-overloaded/
// saturated CSS flicker (see App.css history for the prior treatment).
// Kept as an immutable-state pure module (mirrors flowAnimationSmoothing.ts's
// split: this file holds no state itself, `pushSparklineSample` is a pure
// function from (previous state, new sample) to (next state)) so it's
// trivially unit-testable without mounting React (constitution VI), and so
// HostStatusSparkline.tsx can thread it through a useRef exactly like
// HeatEdge.tsx threads FlowAnimationState.

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
