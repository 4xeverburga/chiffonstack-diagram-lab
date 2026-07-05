import type { Edge, Node } from '@xyflow/react'

// Starter topology matching the ChiffonStack teardown diagram language
// (see DESIGN.md §4 Case-Study Teardown / §7 Isotype & Logo).
// Author your layout here — drag new nodes in from the sidebar, wire them
// up, then export. Every default edge carries explicit handle ids and
// styling fields so the starter diagram renders deterministically and
// exercises the canonical shape end to end.
//
// user/router carry a starter simulation role (generator/sink) so the
// walking-skeleton demo works the moment the app loads — Start is
// immediately clickable without first manually assigning roles.
export const initialNodes: Node[] = [
  {
    id: 'user',
    type: 'labelNode',
    position: { x: 0, y: 80 },
    data: { label: 'user', sim: { role: 'generator', ratePerSec: 100 } },
    className: 'node',
  },
  {
    id: 'router',
    type: 'labelNode',
    position: { x: 220, y: 80 },
    data: { label: 'router', sim: { role: 'sink' } },
    className: 'node node-active',
  },
  { id: 'tool', type: 'labelNode', position: { x: 460, y: 0 }, data: { label: 'tool' }, className: 'node' },
  { id: 'fallback', type: 'labelNode', position: { x: 460, y: 160 }, data: { label: 'fallback' }, className: 'node node-dim' },
]

export const initialEdges: Edge[] = [
  {
    id: 'user-router',
    source: 'user',
    target: 'router',
    type: 'heat',
    data: { variant: 'heat-flow' },
    sourceHandle: 'right',
    targetHandle: 'left',
  },
  {
    id: 'router-tool',
    source: 'router',
    target: 'tool',
    type: 'heat',
    data: { variant: 'heat-static' },
    sourceHandle: 'right',
    targetHandle: 'left',
  },
  {
    id: 'router-fallback',
    source: 'router',
    target: 'fallback',
    type: 'heat',
    data: { variant: 'dashed' },
    sourceHandle: 'right',
    targetHandle: 'left',
  },
  {
    id: 'tool-fallback',
    source: 'tool',
    target: 'fallback',
    type: 'heat',
    data: { variant: 'default' },
    sourceHandle: 'bottom',
    targetHandle: 'top',
  },
]
