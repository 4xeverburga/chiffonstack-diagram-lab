import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import type { HeatVariant } from './heatVariants'

// The "flowing heat path" edge from the Langflow/n8n reference: a live path
// through a topology gets a moving gradient in the user's primary token
// color, everything else stays a plain hairline or dashed fallback.
// `primaryColor` rides in on `data` (set by App.tsx on every render) rather
// than as a dedicated prop, so `edgeTypes` can stay a stable module-level
// constant and React Flow doesn't remount edges when the color changes.
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
}: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const { variant = 'default', primaryColor = '#ff4715' } =
    (data as { variant?: HeatVariant; primaryColor?: string } | undefined) ?? {}
  const isHeat = variant === 'heat-flow' || variant === 'heat-static'
  const gradientId = `heat-gradient-${id}`

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
        className={`lab-edge lab-edge-${variant}`}
        style={isHeat ? { stroke: `url(#${gradientId})` } : undefined}
      />
    </>
  )
}
