// Pure geometry for the snap-while-dragging helper (spec 006, US1).
// No React Flow imports here on purpose — computeGuides only knows about
// plain rectangles, so it stays trivially unit-testable and can never reach
// into node/store internals (contracts/layout-helpers.md).

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Guide {
  axis: 'x' | 'y'
  at: number
  kind: 'start' | 'center' | 'end'
}

export interface SnapResult {
  guides: Guide[]
  position: { x: number; y: number }
}

type AxisEdges = { start: number; center: number; end: number }

function axisEdges(rect: Rect, axis: 'x' | 'y'): AxisEdges {
  if (axis === 'x') {
    return { start: rect.x, center: rect.x + rect.width / 2, end: rect.x + rect.width }
  }
  return { start: rect.y, center: rect.y + rect.height / 2, end: rect.y + rect.height }
}

// Compares every edge/center of `dragged` against every edge/center of every
// rect in `others` on one axis (research.md R1), keeping only the nearest
// match within `thresholdFlow`. Returns the signed offset needed to move
// `dragged` onto that match, or 0 with no guide when nothing is within range.
function snapAxis(
  dragged: Rect,
  others: Rect[],
  axis: 'x' | 'y',
  thresholdFlow: number,
): { guide: Guide | undefined; offset: number } {
  const draggedEdges = axisEdges(dragged, axis)
  let best: { delta: number; guide: Guide } | undefined

  for (const other of others) {
    const otherEdges = axisEdges(other, axis)
    for (const kind of ['start', 'center', 'end'] as const) {
      const draggedValue = draggedEdges[kind]
      for (const otherKind of ['start', 'center', 'end'] as const) {
        const otherValue = otherEdges[otherKind]
        const delta = otherValue - draggedValue
        if (Math.abs(delta) <= thresholdFlow && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, guide: { axis, at: otherValue, kind } }
        }
      }
    }
  }

  return best ? { guide: best.guide, offset: best.delta } : { guide: undefined, offset: 0 }
}

// computeGuides never mutates `dragged` or `others` — it always returns a
// fresh position object (contracts/layout-helpers.md). Each axis snaps
// independently, so a node can align on x while free on y (or vice versa).
export function computeGuides(dragged: Rect, others: Rect[], thresholdFlow: number): SnapResult {
  if (thresholdFlow <= 0 || others.length === 0) {
    return { guides: [], position: { x: dragged.x, y: dragged.y } }
  }

  const guides: Guide[] = []
  const xSnap = snapAxis(dragged, others, 'x', thresholdFlow)
  if (xSnap.guide) guides.push(xSnap.guide)
  const ySnap = snapAxis(dragged, others, 'y', thresholdFlow)
  if (ySnap.guide) guides.push(ySnap.guide)

  return {
    guides,
    position: { x: dragged.x + xSnap.offset, y: dragged.y + ySnap.offset },
  }
}
