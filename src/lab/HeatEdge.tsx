import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { HeatVariant } from './heatVariants'
import { edgeStyleClassNames, resolveDirection, resolveThickness } from './edgeStyle'
import { EdgeToolbar } from './EdgeToolbar'
import { DEFAULT_SIGMOID_MAPPING_CONFIG, DEFAULT_FLOW_SMOOTHING_CONFIG } from '../engine/config'
import type { SigmoidMappingConfig } from '../engine/sigmoidMapping'
import { createInitialFlowAnimationState, updateFlowAnimationState, type FlowAnimationState } from '../engine/flowAnimationSmoothing'

// The "flowing heat path" edge from the Langflow/n8n reference: a live path
// through a topology gets a moving gradient in the user's primary token
// color, everything else stays a plain hairline or dashed fallback.
// `primaryColor` and the toolbar callbacks ride in on `data` (set by
// App.tsx on every render) rather than as dedicated props, so `edgeTypes`
// can stay a stable module-level constant and React Flow doesn't remount
// edges when they change. They never reach the canonical JSON —
// exportDiagram.ts whitelists edge data on both serialize and parse.
export function HeatEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const {
    variant = 'default',
    primaryColor = '#ff4715',
    mappingConfig = DEFAULT_SIGMOID_MAPPING_CONFIG,
    onCycleThickness,
    onReverseDirection,
  } = (data as {
    variant?: HeatVariant
    primaryColor?: string
    mappingConfig?: SigmoidMappingConfig
    onCycleThickness?: (id: string) => void
    onReverseDirection?: (id: string) => void
  } | undefined) ?? {}
  const thickness = resolveThickness((data as { thickness?: unknown } | undefined)?.thickness)
  const direction = resolveDirection((data as { direction?: unknown } | undefined)?.direction)
  const isHeat = variant === 'heat-flow' || variant === 'heat-static'
  const gradientId = `heat-gradient-${id}`

  // Bounded logistic mapping (constitution Principle V) from this edge's
  // last metrics-window throughput onto CSS variables consumed by the
  // .lab-edge-heat-flow keyframe animation below — undefined (no
  // simMetrics, i.e. no simulation running yet) falls back to the
  // pre-pivot static 0.7s/6 6 defaults declared in App.css. The raw
  // per-window reading is noisy (Poisson variance), so it's smoothed
  // through flowAnimationSmoothing before it ever reaches CSS — see that
  // module for the two-timescale EMA + hysteresis/hold-time design.
  // mappingConfig rides in on data (App.tsx, from the traffic-scale
  // dropdown) rather than always using the fixed default — what counts as
  // "fast"/"saturated" throughput is architecture-dependent (src/engine/
  // config.ts's SIGMOID_MAPPING_BY_TRAFFIC_SCALE), so it must be tunable
  // per diagram, not a single hardcoded curve for every project.
  const throughputPerSec = (data as { simMetrics?: { throughputPerSec: number } } | undefined)?.simMetrics?.throughputPerSec
  // Dual-unit display (US3, FR-007): 009 already computes both units for
  // producer/consumer<->kafka edges (kafkaModel.ts) and delivers them
  // through the same simMetrics channel as throughputPerSec above — no
  // conversion happens here, this only renders values the engine already
  // emitted, so it can never disagree with the engine's own numbers.
  const dualUnitMetrics = (data as { simMetrics?: { nativeThroughputPerSec?: number; throughputMBps?: number } } | undefined)
    ?.simMetrics
  const hasDualUnits = dualUnitMetrics?.nativeThroughputPerSec !== undefined && dualUnitMetrics?.throughputMBps !== undefined
  const smoothingRef = useRef<FlowAnimationState>(createInitialFlowAnimationState(mappingConfig))
  const [committedAnimation, setCommittedAnimation] = useState(() => smoothingRef.current.committed)

  useEffect(() => {
    if (throughputPerSec === undefined) {
      // Simulation stopped/reset — start the next run's smoothing fresh
      // rather than resuming from a stale baseline.
      smoothingRef.current = createInitialFlowAnimationState(mappingConfig)
      return
    }
    const next = updateFlowAnimationState(smoothingRef.current, throughputPerSec, Date.now(), DEFAULT_FLOW_SMOOTHING_CONFIG, mappingConfig)
    smoothingRef.current = next
    setCommittedAnimation((current) => (next.committed === current ? current : next.committed))
  }, [throughputPerSec, mappingConfig])

  const flowStyle: CSSProperties | undefined =
    throughputPerSec === undefined
      ? undefined
      : (() => {
          const { durationSec, dashDensity } = committedAnimation
          const dashLength = 6
          const gap = 2 + (1 - dashDensity) * 10
          return {
            '--sim-flow-duration': `${durationSec}s`,
            '--sim-flow-dash': `${dashLength} ${gap}`,
            // The @keyframes heat-flow loop in App.css travels exactly this
            // distance every iteration — it must be a multiple of the
            // current dash pattern's total repeat length (dash + gap) or
            // the loop visibly snaps to a different phase every cycle once
            // a throughput-driven gap stops evenly dividing a hardcoded
            // distance. Computed here (not via CSS calc()) because
            // wrapping an unwrapped/unitless custom property in calc() for
            // an SVG-ish property like stroke-dashoffset doesn't reliably
            // resolve in the browser — verified live: getComputedStyle
            // returned the literal unresolved string "calc(24px)" instead
            // of a number, which silently broke the whole animation.
            '--sim-flow-loop-distance': `${(dashLength + gap) * 2}`,
          } as CSSProperties
        })()

  return (
    <>
      {isHeat ? (
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="100%" stopColor={primaryColor} />
          </linearGradient>
        </defs>
      ) : null}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={edgeStyleClassNames(variant, thickness, direction, 'lab-edge')}
        style={{ ...(isHeat ? { stroke: `url(#${gradientId})` } : undefined), ...flowStyle }}
      />
      {selected && onCycleThickness && onReverseDirection ? (
        <EdgeToolbar
          x={labelX}
          y={labelY}
          showReverse={variant === 'heat-flow'}
          onCycleThickness={() => onCycleThickness(id)}
          onReverseDirection={() => onReverseDirection(id)}
        />
      ) : null}
      {hasDualUnits ? (
        <EdgeLabelRenderer>
          <div
            className="lab-edge-dual-unit-label nodrag nopan"
            style={{ transform: `translate(${labelX}px, ${labelY}px) translate(-50%, 20%)` }}
          >
            {dualUnitMetrics!.nativeThroughputPerSec!.toFixed(1)} msg/s / {dualUnitMetrics!.throughputMBps!.toFixed(2)} MB/s
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

