import type { Edge, Node } from '@xyflow/react'

// One of everything the canvas can render: every node kind, an image node,
// a manually resized node, and all four edge variants — used across every
// export generator's tests so they all agree on what "full fidelity" means
// (see the fidelity mapping tables in specs/001-export-suite/contracts/).
const PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

export const kitchenSinkNodes: Node[] = [
  { id: 'default-node', type: 'labelNode', position: { x: 0, y: 0 }, data: { label: 'default' }, className: 'node' },
  {
    id: 'active-node',
    type: 'labelNode',
    position: { x: 200, y: 0 },
    data: { label: 'active' },
    className: 'node node-active',
  },
  {
    id: 'dim-node',
    type: 'labelNode',
    position: { x: 400, y: 0 },
    data: { label: 'dim' },
    className: 'node node-dim',
  },
  {
    id: 'image-node',
    type: 'labelNode',
    position: { x: 0, y: 160 },
    data: { label: 'image', image: PIXEL_PNG },
    className: 'node',
  },
  {
    id: 'resized-node',
    type: 'labelNode',
    position: { x: 200, y: 160 },
    data: { label: 'resized' },
    className: 'node',
    width: 220,
    height: 96,
  },
]

export const kitchenSinkEdges: Edge[] = [
  { id: 'default-active', source: 'default-node', target: 'active-node', type: 'heat', data: { variant: 'default' } },
  { id: 'active-dim', source: 'active-node', target: 'dim-node', type: 'heat', data: { variant: 'dashed' } },
  {
    id: 'image-resized',
    source: 'image-node',
    target: 'resized-node',
    type: 'heat',
    data: { variant: 'heat-flow' },
  },
  {
    id: 'default-image',
    source: 'default-node',
    target: 'image-node',
    type: 'heat',
    data: { variant: 'heat-static' },
  },
]
