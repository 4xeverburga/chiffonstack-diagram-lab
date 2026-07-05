import { Handle, Position, type NodeProps } from '@xyflow/react'

// Custom node used for every diagram box: keeps the existing className-driven
// look (node / node-active / node-dim). Renaming happens from the Inspector
// sidebar only — the node itself is display-only.
export function LabelNode({ data }: NodeProps) {
  const label = typeof data.label === 'string' ? data.label : ''

  return (
    <>
      <Handle type="target" position={Position.Left} />
      <span className="node-label">{label}</span>
      <Handle type="source" position={Position.Right} />
    </>
  )
}

