import { Handle, NodeResizer, type NodeProps } from '@xyflow/react'
import { HANDLE_SIDES, HANDLE_SIDE_POSITION } from './handleSides'

// Custom node used for every diagram box: keeps the existing className-driven
// look (node / node-active / node-dim). Renaming and image assignment happen
// from the Inspector sidebar only — the node itself is display-only.
//
// NodeResizer lets the user drag the node's own bounding box bigger (handy
// once an image is attached and the default auto-sized box is too small to
// see it clearly). It only needs to be rendered here — React Flow's standard
// onNodesChange pipeline (already wired in App.tsx via useNodesState) picks
// up the resulting width/height changes automatically.
//
// Four handles (top/bottom/left/right), each `type="source"`: combined with
// `connectionMode="loose"` on the canvas's <ReactFlow> (App.tsx), any handle
// can both originate and receive a connection (FR-001, research.md R1) — a
// single handle per side keeps the DOM minimal and its id unambiguous, since
// that same id is the serialized sourceHandle/targetHandle value (handleSides.ts).
// Visibility (hidden at rest, revealed on hover/selection/connecting) is
// pure CSS in App.css — nothing here decides when a handle is shown.
export function LabelNode({ data, selected }: NodeProps) {
  const label = typeof data.label === 'string' ? data.label : ''
  const image = typeof data.image === 'string' ? data.image : undefined

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={64}
        minHeight={40}
        handleClassName="node-resize-handle"
        lineClassName="node-resize-line"
      />
      {HANDLE_SIDES.map((side) => (
        <Handle key={side} id={side} type="source" position={HANDLE_SIDE_POSITION[side]} />
      ))}
      <div className="node-content">
        {image ? <img className="node-image" src={image} alt="" /> : null}
        <span className="node-label">{label}</span>
      </div>
    </>
  )
}

