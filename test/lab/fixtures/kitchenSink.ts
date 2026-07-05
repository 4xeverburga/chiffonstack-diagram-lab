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
  // Thickness steps and a reversed heat-flow are spread across the edges so
  // every export generator's tests exercise the 003 styling fields; the
  // heat-static edge stays field-free to keep covering the legacy-default
  // path (thickness "normal", direction "forward" on export).
  {
    id: 'default-active',
    source: 'default-node',
    target: 'active-node',
    type: 'heat',
    data: { variant: 'default', thickness: 'thin' },
  },
  {
    id: 'active-dim',
    source: 'active-node',
    target: 'dim-node',
    type: 'heat',
    data: { variant: 'dashed', thickness: 'thick' },
  },
  {
    id: 'image-resized',
    source: 'image-node',
    target: 'resized-node',
    type: 'heat',
    data: { variant: 'heat-flow', thickness: 'normal', direction: 'reverse' },
  },
  {
    id: 'default-image',
    source: 'default-node',
    target: 'image-node',
    type: 'heat',
    data: { variant: 'heat-static' },
  },
]
