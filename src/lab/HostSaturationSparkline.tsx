import { useEffect, useRef, useState } from 'react'
import { SPARKLINE_HISTORY_LENGTH } from 'sugar-skills'
import { createInitialSparklineHistory, pushSparklineSample, type SparklineHistoryState } from './hostSparklineHistory'
import type { HostNodeMetrics } from 'sugar-skills'

// An always-on live saturation gauge for every saturating-capable host
// (transactional_api/worker_consumer/database_server) — see LabelNode.tsx,
// which renders this for those profiles in EVERY state: idle/editing,
// healthy, saturated, and overloaded alike, not only once a host turns
// saturated. That "only render when saturated/overloaded" gate is exactly
// what an earlier iteration of this widget did (as a box-shadow flicker
// before it, and briefly as this same sparkline) — and it meant the node's
// own footprint grew the instant a simulation made a host struggle
// (measured live: an autoscaling host went from ~98x95px idle to
// ~125x141px mid-simulation, purely from this widget's DOM popping in).
// Rendering it unconditionally, with a neutral "idle" placeholder before
// the first metrics window exists, makes the node's footprint identical
// across every state; only the widget's OWN internal color/values change
// (App.css's .host-sparkline-active modifier).
//
// Plots saturationRatio (not forwardedRPS, an earlier iteration's choice)
// — restoring the always-visible saturation% reading that the old
// per-replica chip text used to carry before the scaling-group visual
// became a capacity bar (scalingGroupProjection.ts). The vertical domain
// has a floor at 1.0 (100%) rather than autoscaling to each window's own
// peak: that keeps "100% saturated" landing at a stable, comparable chart
// height across hosts and over time, and only zooms the domain out past
// that floor for a genuine overload excursion — at which point a dashed
// reference line marks where the old 100% ceiling was, so "how far past
// the line" stays legible instead of the whole curve just looking like a
// generic climb.
//
// State handling mirrors HeatEdge.tsx's smoothing pattern: a useRef holds
// the authoritative ring-buffer state (hostSparklineHistory.ts, a pure
// module so it's unit-testable without mounting React), a useState mirror
// triggers the re-render React needs to actually paint the new point.
// Keyed on `windowKey` (the metrics window's windowEndSimTimeMs) rather
// than reacting to `saturationRatio` directly — that value changes every
// render for other reasons (selection, hover), but a new *sample* should
// only ever be recorded once per simulated metrics window.
interface HostSaturationSparklineProps {
  /** undefined before the first simulated metrics window (idle, or after
   *  Reset) — rendered as a neutral "idle" placeholder rather than
   *  omitted; see this file's header for why omitting it was the bug. */
  status: HostNodeMetrics['status'] | undefined
  /** This window's saturationRatio — unclamped, so can read past 100%. */
  saturationRatio: number | undefined
  /** The metrics window's windowEndSimTimeMs, or undefined when idle/reset
   *  — an explicit tick identity so history only grows once per window
   *  instead of once per render. */
  windowKey: number | undefined
}

const VIEWBOX_WIDTH = 100
const VIEWBOX_HEIGHT = 28
// The chart's vertical domain never zooms in below this ceiling — see
// this file's header.
const DOMAIN_FLOOR = 1

function sparklineGeometry(samples: number[]) {
  const domainMax = Math.max(DOMAIN_FLOOR, ...samples)
  const coords = samples.map((sample, index) => {
    const x = samples.length > 1 ? (index / (samples.length - 1)) * VIEWBOX_WIDTH : VIEWBOX_WIDTH
    const y = VIEWBOX_HEIGHT - (Math.min(sample, domainMax) / domainMax) * VIEWBOX_HEIGHT
    return { x, y }
  })
  const linePoints = coords.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = coords.at(-1)
  const areaPoints = coords.length > 0 ? `0,${VIEWBOX_HEIGHT} ${linePoints} ${VIEWBOX_WIDTH},${VIEWBOX_HEIGHT}` : ''
  // Only drawn once the domain has genuinely zoomed out past the floor —
  // otherwise it exactly coincides with the chart's own top edge and
  // would just look like a second border.
  const referenceLineY = domainMax > DOMAIN_FLOOR ? VIEWBOX_HEIGHT - (DOMAIN_FLOOR / domainMax) * VIEWBOX_HEIGHT : undefined
  return { linePoints, areaPoints, dotX: last?.x ?? VIEWBOX_WIDTH, dotY: last?.y ?? VIEWBOX_HEIGHT, referenceLineY }
}

export function HostSaturationSparkline({ status, saturationRatio, windowKey }: HostSaturationSparklineProps) {
  const historyRef = useRef<SparklineHistoryState>(createInitialSparklineHistory())
  const [samples, setSamples] = useState<number[]>([])

  useEffect(() => {
    if (windowKey === undefined) {
      historyRef.current = createInitialSparklineHistory()
      setSamples([])
      return
    }
    const next = pushSparklineSample(historyRef.current, saturationRatio ?? 0, SPARKLINE_HISTORY_LENGTH)
    historyRef.current = next
    setSamples(next.samples)
    // `saturationRatio` is intentionally read at the instant `windowKey`
    // changes (same instant it was produced), not re-run whenever
    // `saturationRatio` itself changes for unrelated reasons — HeatEdge.tsx's
    // smoothingRef follows the identical convention for the same reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowKey])

  const isActive = status === 'saturated' || status === 'overloaded' || status === 'collapsed'
  // A flat baseline at rest (idle/pre-simulation) rather than an empty
  // chart — reads as "at zero", not as a missing widget.
  const displaySamples = samples.length > 0 ? samples : [0, 0]
  const { linePoints, areaPoints, dotX, dotY, referenceLineY } = sparklineGeometry(displaySamples)
  const statusLabel = status ?? 'idle'
  const valueLabel = saturationRatio !== undefined ? `${(saturationRatio * 100).toFixed(0)}%` : '\u2014'

  return (
    <div className={`host-sparkline${isActive ? ' host-sparkline-active' : ''}`} data-testid="host-saturation-sparkline">
      <div className="host-sparkline-header">
        <span className="host-sparkline-status">{statusLabel}</span>
        <span className="host-sparkline-value">{valueLabel}</span>
      </div>
      <svg className="host-sparkline-svg" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        {referenceLineY !== undefined ? (
          <line className="host-sparkline-reference" x1={0} y1={referenceLineY} x2={VIEWBOX_WIDTH} y2={referenceLineY} />
        ) : null}
        <polygon className="host-sparkline-area" points={areaPoints} />
        <polyline className="host-sparkline-line" points={linePoints} />
        <circle className="host-sparkline-dot" cx={dotX} cy={dotY} r={1.8} />
      </svg>
    </div>
  )
}
