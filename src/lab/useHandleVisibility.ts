import { useMemo } from 'react'
import type { OnSelectionChangeParams } from '@xyflow/react'

// Which nodes should show their connection handles right now, derived from
// the canvas's current selection (US2, FR-002): a selected node shows its
// own handles, and a selected edge shows both of its endpoint nodes' handles
// — so a user can see where the edge they're inspecting actually attaches.
// Hover and in-progress connection-drag reveal are handled separately by
// pure CSS (App.css) and a `connecting` class (App.tsx); this hook only
// covers the "selection" half of FR-002's visibility rule.
export function computeHandlesVisibleNodeIds(selection: OnSelectionChangeParams): Set<string> {
  const ids = new Set<string>()
  for (const node of selection.nodes) {
    ids.add(node.id)
  }
  for (const edge of selection.edges) {
    ids.add(edge.source)
    ids.add(edge.target)
  }
  return ids
}

export function useHandleVisibility(selection: OnSelectionChangeParams): Set<string> {
  return useMemo(() => computeHandlesVisibleNodeIds(selection), [selection])
}

// Applies (or removes) the "handles-visible" class to a node's className.
// Must be idempotent — strip any existing "handles-visible" token before
// deciding whether to add it back, never a blind append. These exact node
// objects are handed to <ReactFlow nodes>, and React Flow's own store
// round-trips them: e.g. a NodeResizer drag reads the currently-rendered
// node (already carrying this class) and merges its own width/height update
// on top via updateNode, which then flows back into app state through
// onNodesChange. A blind append bakes a permanent — and, across a
// multi-step resize drag, repeatedly duplicated — "handles-visible" into
// real node state, leaving connection handles stuck visible forever after
// the drag ends.
export function withHandlesVisibleClass(className: string | undefined, visible: boolean): string {
  const baseClassName = (className ?? '')
    .split(' ')
    .filter((token) => token && token !== 'handles-visible')
    .join(' ')
  return visible ? `${baseClassName} handles-visible`.trim() : baseClassName
}
