import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'

// Custom node used for every diagram box: keeps the existing className-driven
// look (node / node-active / node-dim). Renaming and image assignment happen
// from the Inspector sidebar only — the node itself is display-only.
//
// NodeResizer lets the user drag the node's own bounding box bigger (handy
// once an image is attached and the default auto-sized box is too small to
// see it clearly). It only needs to be rendered here — React Flow's standard
// onNodesChange pipeline (already wired in App.tsx via useNodesState) picks
// up the resulting width/height changes automatically.
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
      <Handle type="target" position={Position.Left} />
      <div className="node-content">
        {image ? <img className="node-image" src={image} alt="" /> : null}
        <span className="node-label">{label}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  )
}

