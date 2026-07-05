import { EdgeLabelRenderer, useViewport } from '@xyflow/react'
import type { Guide } from './layout'

type AlignmentGuidesProps = {
  guides: Guide[]
}

// A guide line is rendered as a very long div through the matched
// coordinate so it always spans the visible canvas regardless of pan/zoom
// (research.md R5) — EdgeLabelRenderer's portal already carries the
// viewport's own transform, so this translate() is plain flow-space, same
// as EdgeToolbar.tsx. Renders nothing while idle (FR-003); never touches
// the canonical diagram JSON (FR-005).
const GUIDE_LENGTH_FLOW = 20000

export function AlignmentGuides({ guides }: AlignmentGuidesProps) {
  const { zoom } = useViewport()
  if (guides.length === 0) return null

  // Divide by zoom so the line reads as a consistent ~1 screen pixel wide,
  // whether the canvas is zoomed in or out.
  const strokeWidth = 1 / zoom
  const half = GUIDE_LENGTH_FLOW / 2

  return (
    <EdgeLabelRenderer>
      {guides.map((guide) => {
        const isVertical = guide.axis === 'x'
        return (
          <div
            key={`${guide.axis}-${guide.kind}-${guide.at}`}
            className="lab-alignment-guide"
            style={
              isVertical
                ? {
                    transform: `translate(${guide.at}px, ${-half}px)`,
                    width: `${strokeWidth}px`,
                    height: `${GUIDE_LENGTH_FLOW}px`,
                  }
                : {
                    transform: `translate(${-half}px, ${guide.at}px)`,
                    width: `${GUIDE_LENGTH_FLOW}px`,
                    height: `${strokeWidth}px`,
                  }
            }
          />
        )
      })}
    </EdgeLabelRenderer>
  )
}
