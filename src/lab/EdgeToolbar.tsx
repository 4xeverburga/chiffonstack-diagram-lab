import { EdgeLabelRenderer } from '@xyflow/react'

type EdgeToolbarProps = {
  x: number
  y: number
  showReverse: boolean
  onCycleThickness: () => void
  onReverseDirection: () => void
}

// Floating quick actions for the selected edge, anchored at the bezier
// midpoint via EdgeLabelRenderer so it tracks pan/zoom for free
// (research.md R4). Rendered only while the edge is selected (HeatEdge.tsx
// guards) — the canvas carries zero edge controls at rest (spec US3).
// Offset upward from the midpoint so a very short edge isn't covered by
// its own controls (spec edge case). `nodrag nopan` keeps clicks on the
// buttons from starting a canvas pan or drag.
export function EdgeToolbar({ x, y, showReverse, onCycleThickness, onReverseDirection }: EdgeToolbarProps) {
  return (
    <EdgeLabelRenderer>
      <div
        className="lab-edge-toolbar nodrag nopan"
        style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -150%)` }}
      >
        <button
          type="button"
          aria-label="Cycle edge thickness (thin, normal, thick)"
          title="Thickness"
          onClick={onCycleThickness}
        >
          ≡
        </button>
        {showReverse ? (
          <button
            type="button"
            aria-label="Reverse flow animation direction"
            title="Reverse flow"
            onClick={onReverseDirection}
          >
            ⇆
          </button>
        ) : null}
      </div>
    </EdgeLabelRenderer>
  )
}
