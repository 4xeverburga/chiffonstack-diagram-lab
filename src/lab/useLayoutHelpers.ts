import { useCallback, useEffect, useRef, useState } from 'react'
import { useViewport, type Node, type NodeChange, type OnNodesChange } from '@xyflow/react'
import { computeGuides, type Guide, type Rect } from './layout'

// Snap threshold in screen pixels (constant regardless of zoom) — converted
// to flow-space units below via the live zoom before every comparison
// (research.md R3), so it feels the same whether zoomed in or out.
const SNAP_THRESHOLD_PX = 6

function toRect(node: Node): Rect {
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? node.width ?? 0,
    height: node.measured?.height ?? node.height ?? 0,
  }
}

// Wraps the app's onNodesChange (from useNodesState) to add snap-to-node
// alignment guides while dragging (spec 006, US1). Must intercept here
// rather than in onNodeDrag: XYDrag dispatches the position NodeChange
// (which is what actually reaches controlled state) before it calls
// onNodeDrag, so onNodeDrag always fires too late to influence the applied
// position (confirmed in @xyflow/system's XYDrag.updateNodes).
//
// The Alt/Option modifier (research.md R4) can't be read from NodeChange
// either (it carries no DOM event), so it's tracked independently via
// window-level keydown/keyup listeners instead of the drag event.
export function useLayoutHelpers(nodes: Node[], onNodesChangeBase: OnNodesChange) {
  const [guides, setGuides] = useState<Guide[]>([])
  const { zoom } = useViewport()
  const altPressedRef = useRef(false)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt') altPressedRef.current = true
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt') altPressedRef.current = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const onNodesChange = useCallback<OnNodesChange>(
    (changes) => {
      const thresholdFlow = SNAP_THRESHOLD_PX / zoom
      const currentNodes = nodesRef.current
      let activeGuides: Guide[] = []
      let sawActiveDrag = false

      const adjusted: NodeChange[] = changes.map((change) => {
        if (change.type !== 'position' || !change.position) return change
        if (change.dragging) sawActiveDrag = true
        if (altPressedRef.current) return change

        const draggedNode = currentNodes.find((node) => node.id === change.id)
        if (!draggedNode) return change

        const dragged: Rect = {
          x: change.position.x,
          y: change.position.y,
          width: draggedNode.measured?.width ?? draggedNode.width ?? 0,
          height: draggedNode.measured?.height ?? draggedNode.height ?? 0,
        }
        const others = currentNodes.filter((node) => node.id !== change.id).map(toRect)
        const result = computeGuides(dragged, others, thresholdFlow)

        if (change.dragging) activeGuides = result.guides
        if (result.guides.length === 0) return change
        return { ...change, position: result.position }
      })

      setGuides((current) => {
        const next = sawActiveDrag ? activeGuides : []
        return next.length === 0 && current.length === 0 ? current : next
      })
      onNodesChangeBase(adjusted)
    },
    [zoom, onNodesChangeBase],
  )

  return { guides, onNodesChange }
}
