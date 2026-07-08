import { useEffect, useRef, useState } from 'react'
import { SPARKLINE_HISTORY_LENGTH } from '../engine/config'
import { createInitialSparklineHistory, pushSparklineSample, type SparklineHistoryState } from './hostSparklineHistory'
import type { HostNodeMetrics } from '../engine/ports'

// The live-data replacement for the sim-status-saturated/overloaded CSS
// box-shadow flicker (App.css history). The old treatment signaled
// "something is wrong" with an abstract glow whose timing pattern (smooth
// breathing vs stepped flicker) was the only saturated-vs-overloaded
// differentiator — real but too subtle to read at a glance, and identical
// whether a host was 10% or 300% over capacity. This renders the host's
// actual forwardedRPS (goodput) as a small trailing sparkline instead: the
// line itself IS the telemetry, not a decorative pulse — when a future
// `overloadBehavior: 'collapse'` host bends its goodput back down past
// capacity (PRODUCT.md), this sparkline will show that bend the moment the
// engine computes it, with no changes needed here. Today, with only the
// `clamp` behavior implemented, the line plateaus at the host's cap
// instead — still a meaningfully different shape from "healthy and
// climbing", which is the point.
//
// State handling mirrors HeatEdge.tsx's smoothing pattern: a useRef holds
// the authoritative ring-buffer state (hostSparklineHistory.ts, a pure
// module so it's unit-testable without mounting React), a useState mirror
// triggers the re-render React needs to actually paint the new point.
// Keyed on `windowKey` (the metrics window's windowEndSimTimeMs) rather
// than reacting to `value` directly — value changes every render for other
// reasons (selection, hover), but a new *sample* should only ever be
// recorded once per simulated metrics window.
interface HostStatusSparklineProps {
  status: Extract<HostNodeMetrics['status'], 'saturated' | 'overloaded'>
  /** This window's forwardedRPS (goodput) reading for the host. */
  value: number
  /** The metrics window's windowEndSimTimeMs, or undefined when idle/reset
   *  — an explicit tick identity so history only grows once per window
   *  instead of once per render. */
  windowKey: number | undefined
}

const VIEWBOX_WIDTH = 100
const VIEWBOX_HEIGHT = 28

function sparklinePoints(samples: number[]): { linePoints: string; areaPoints: string; dotX: number; dotY: number } {
  const max = Math.max(...samples, 1e-6)
  const coords = samples.map((sample, index) => {
    const x = samples.length > 1 ? (index / (samples.length - 1)) * VIEWBOX_WIDTH : VIEWBOX_WIDTH
    const y = VIEWBOX_HEIGHT - (sample / max) * VIEWBOX_HEIGHT
    return { x, y }
  })
  const linePoints = coords.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = coords.at(-1)!
  const areaPoints = `0,${VIEWBOX_HEIGHT} ${linePoints} ${VIEWBOX_WIDTH},${VIEWBOX_HEIGHT}`
  return { linePoints, areaPoints, dotX: last.x, dotY: last.y }
}

export function HostStatusSparkline({ status, value, windowKey }: HostStatusSparklineProps) {
  const historyRef = useRef<SparklineHistoryState>(createInitialSparklineHistory())
  const [samples, setSamples] = useState<number[]>([])

  useEffect(() => {
    if (windowKey === undefined) {
      historyRef.current = createInitialSparklineHistory()
      setSamples([])
      return
    }
    const next = pushSparklineSample(historyRef.current, value, SPARKLINE_HISTORY_LENGTH)
    historyRef.current = next
    setSamples(next.samples)
    // `value` is intentionally read at the instant `windowKey` changes
    // (same instant it was produced), not re-run whenever `value` itself
    // changes for unrelated reasons — HeatEdge.tsx's smoothingRef follows
    // the identical convention for the same reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowKey])

  if (samples.length === 0) return null

  const { linePoints, areaPoints, dotX, dotY } = sparklinePoints(samples)

  return (
    <div className={`host-sparkline host-sparkline-${status}`} data-testid="host-status-sparkline">
      <div className="host-sparkline-header">
        <span className="host-sparkline-status">{status}</span>
        <span className="host-sparkline-value">{value.toFixed(1)} req/s</span>
      </div>
      <svg className="host-sparkline-svg" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        <polygon className="host-sparkline-area" points={areaPoints} />
        <polyline className="host-sparkline-line" points={linePoints} />
        <circle className="host-sparkline-dot" cx={dotX} cy={dotY} r={1.8} />
      </svg>
    </div>
  )
}
