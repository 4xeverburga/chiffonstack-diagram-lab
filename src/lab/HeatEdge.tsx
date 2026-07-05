import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import type { CSSProperties } from 'react'
import type { HeatVariant } from './heatVariants'
import { edgeStyleClassNames, resolveDirection, resolveThickness } from './edgeStyle'
import { EdgeToolbar } from './EdgeToolbar'
import { DEFAULT_SIGMOID_MAPPING_CONFIG, mapThroughputToAnimation } from '../engine/sigmoidMapping'

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
    onCycleThickness,
    onReverseDirection,
  } = (data as {
    variant?: HeatVariant
    primaryColor?: string
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
  // pre-pivot static 0.7s/6 6 defaults declared in App.css.
  const throughputPerSec = (data as { simMetrics?: { throughputPerSec: number } } | undefined)?.simMetrics?.throughputPerSec
  const flowStyle: CSSProperties | undefined =
    throughputPerSec === undefined
      ? undefined
      : (() => {
          const { durationSec, dashDensity } = mapThroughputToAnimation(throughputPerSec, DEFAULT_SIGMOID_MAPPING_CONFIG)
          const gap = 2 + (1 - dashDensity) * 10
          return {
            '--sim-flow-duration': `${durationSec}s`,
            '--sim-flow-dash': `6 ${gap}`,
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
    </>
  )
}

