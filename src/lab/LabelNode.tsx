import { Handle, Position, type NodeProps } from '@xyflow/react'

// Custom node used for every diagram box: keeps the existing className-driven
// look (node / node-active / node-dim). Renaming and image assignment happen
// from the Inspector sidebar only — the node itself is display-only.
export function LabelNode({ data }: NodeProps) {
  const label = typeof data.label === 'string' ? data.label : ''
  const image = typeof data.image === 'string' ? data.image : undefined

  return (
    <>
      <Handle type="target" position={Position.Left} />
      {image ? <img className="node-image" src={image} alt="" /> : null}
      <span className="node-label">{label}</span>
      <Handle type="source" position={Position.Right} />
    </>
  )
}

