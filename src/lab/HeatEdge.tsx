import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import type { HeatVariant } from './heatVariants'

// The "flowing heat path" edge from the Langflow/n8n reference: a live path
// through a topology gets a moving orange->red gradient, everything else
// stays a plain hairline or dashed fallback.
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
  const variant = ((data as { variant?: HeatVariant } | undefined)?.variant) ?? 'default'
  const isHeat = variant === 'heat-flow' || variant === 'heat-static'
  const gradientId = `heat-gradient-${id}`

  return (
    <>
      {isHeat ? (
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
            <stop offset="0%" stopColor="#ff8e05" />
            <stop offset="100%" stopColor="#ff0024" />
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
