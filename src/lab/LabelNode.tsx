import { Handle, NodeResizer, useReactFlow, type NodeProps, type OnResize } from '@xyflow/react'
import { HANDLE_SIDES, HANDLE_SIDE_POSITION } from './handleSides'
import { heightForRatioLockedWidth } from './imageFit'
import { labelBandFor, resolveTextSize } from './textSizes'
import { NodeInfoButton } from './NodeInfoButton'
import type { NodeMetrics, SimRole } from '../engine/ports'

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
// Gated to image nodes only: label text has no size-with-box behavior (its
// font-size only ever changes via the labelSize step in textSizes.ts), so
// resizing a text-only node just stretches an empty box around static text —
// a pointless, confusing affordance that invites the user to expect the text
// to scale. Image nodes are the only case where resizing does something
// visible (a bigger box means a bigger image, see onResize/imageFit.ts
// below), so the handles are only shown when an image is present.
//
// Four handles (top/bottom/left/right), each `type="source"`: combined with
// `connectionMode="loose"` on the canvas's <ReactFlow> (App.tsx), any handle
// can both originate and receive a connection (FR-001, research.md R1) — a
// single handle per side keeps the DOM minimal and its id unambiguous, since
// that same id is the serialized sourceHandle/targetHandle value (handleSides.ts).
// Visibility (hidden at rest, revealed on hover/selection/connecting) is
// pure CSS in App.css — nothing here decides when a handle is shown.
export function LabelNode({ id, data, selected }: NodeProps) {
  const { updateNode } = useReactFlow()
  const label = typeof data.label === 'string' ? data.label : ''
  const image = typeof data.image === 'string' ? data.image : undefined
  const labelSize = resolveTextSize(data.labelSize)
  const sim = data.sim as SimRole | undefined
  const metrics = data.simMetrics as NodeMetrics | undefined
  const imageAspect =
    typeof data.imageAspect === 'number' && Number.isFinite(data.imageAspect) && data.imageAspect > 0
      ? data.imageAspect
      : undefined

  // Width-driven ratio lock (research.md R4): React Flow's own
  // keepAspectRatio prop locks the raw box ratio, which drifts the image
  // area's ratio as the fixed label band scales, letterboxing the image.
  // Deriving height from the dragged width on every resize step keeps the
  // image area's ratio exact at any size (FR-003). Nodes without an
  // imageAspect keep the default unconstrained resize.
  const onResize: OnResize | undefined = imageAspect
    ? (_event, params) => {
        const labelBand = labelBandFor(label, labelSize)
        updateNode(id, { width: params.width, height: heightForRatioLockedWidth(params.width, imageAspect, labelBand) })
      }
    : undefined

  return (
    <>
      <NodeResizer
        isVisible={selected && Boolean(image)}
        minWidth={64}
        minHeight={40}
        handleClassName="node-resize-handle"
        lineClassName="node-resize-line"
        onResize={onResize}
      />
      {HANDLE_SIDES.map((side) => (
        <Handle key={side} id={side} type="source" position={HANDLE_SIDE_POSITION[side]} />
      ))}
      <div className="node-content">
        {image ? <img className="node-image" src={image} alt="" /> : null}
        {label.trim() ? <span className={`node-label node-label-${labelSize}`}>{label}</span> : null}
      </div>
      {sim ? <NodeInfoButton sim={sim} metrics={metrics} /> : null}
    </>
  )
}

