import { useState, type ChangeEvent } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { classNameForKind, type NodeKind } from './nodeKinds'
import { HEAT_VARIANTS, type HeatVariant } from './heatVariants'
import { EDGE_THICKNESSES, resolveDirection, resolveThickness, type EdgeThickness } from './edgeStyle'
import { IMAGE_SIZE_WARNING_BYTES, IMAGE_UPLOAD_ACCEPT, readImageFile } from './imageUpload'

const NODE_KINDS: NodeKind[] = ['default', 'active', 'dim']

type InspectorProps = {
  selectedNode: Node | undefined
  selectedEdge: Edge | undefined
  onRenameNode: (id: string, label: string) => void
  onSetNodeKind: (id: string, kind: NodeKind) => void
  onSetNodeImage: (id: string, image: string | undefined) => void
  onSetEdgeVariant: (id: string, variant: HeatVariant) => void
  onSetEdgeThickness: (id: string, thickness: EdgeThickness) => void
  onReverseEdgeDirection: (id: string) => void
  onDeleteEdge: (id: string) => void
}

// Right-hand style/property panel for whatever is currently selected —
// mirrors the node/edge inspector panes in Langflow's canvas.
export function Inspector({
  selectedNode,
  selectedEdge,
  onRenameNode,
  onSetNodeKind,
  onSetNodeImage,
  onSetEdgeVariant,
  onSetEdgeThickness,
  onReverseEdgeDirection,
  onDeleteEdge,
}: InspectorProps) {
  // Must stay unconditional (Rules of Hooks) even though it's only read in
  // the node branch below; resets naturally on remount via the node's `key`.
  const [sizeWarningBytes, setSizeWarningBytes] = useState<number | undefined>(undefined)

  if (selectedNode) {
    const label = typeof selectedNode.data.label === 'string' ? selectedNode.data.label : ''
    const image = typeof selectedNode.data.image === 'string' ? selectedNode.data.image : undefined

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      readImageFile(file)
        .then(({ dataUri, byteSize }) => {
          onSetNodeImage(selectedNode.id, dataUri)
          setSizeWarningBytes(byteSize > IMAGE_SIZE_WARNING_BYTES ? byteSize : undefined)
        })
        .catch((error: unknown) => {
          console.error('Failed to read image file', error)
        })
    }

    return (
      <aside key={`node-${selectedNode.id}`} className="lab-inspector lab-inspector-flash">
        <h2 className="lab-panel-title">Node</h2>
        <label className="lab-field">
          <span>Label</span>
          <input value={label} onChange={(event) => onRenameNode(selectedNode.id, event.target.value)} />
        </label>
        <div className="lab-field">
          <span>Style</span>
          <div className="lab-button-row">
            {NODE_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={`chip ${selectedNode.className === classNameForKind(kind) ? 'chip-active' : ''}`}
                onClick={() => onSetNodeKind(selectedNode.id, kind)}
              >
                {kind}
              </button>
            ))}
          </div>
        </div>
        <div className="lab-field">
          <span>Image</span>
          {image ? (
            <div className="lab-node-image-preview">
              <img src={image} alt="" />
              <button
                type="button"
                className="lab-danger"
                onClick={() => onSetNodeImage(selectedNode.id, undefined)}
              >
                Remove image
              </button>
            </div>
          ) : (
            <input type="file" accept={IMAGE_UPLOAD_ACCEPT} onChange={handleImageChange} />
          )}
          {sizeWarningBytes !== undefined ? (
            <div className="lab-warning">
              <span>Large image ({Math.round(sizeWarningBytes / 1000)} KB): this is embedded in the diagram JSON and every export — consider compressing.</span>
              <button type="button" className="lab-warning-dismiss" onClick={() => setSizeWarningBytes(undefined)}>
                Dismiss
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    )
  }

  if (selectedEdge) {
    const variant = ((selectedEdge.data as { variant?: HeatVariant } | undefined)?.variant) ?? 'default'
    const thickness = resolveThickness((selectedEdge.data as { thickness?: unknown } | undefined)?.thickness)
    const direction = resolveDirection((selectedEdge.data as { direction?: unknown } | undefined)?.direction)
    return (
      <aside key={`edge-${selectedEdge.id}`} className="lab-inspector lab-inspector-flash">
        <h2 className="lab-panel-title">Edge</h2>
        <div className="lab-field">
          <span>Style</span>
          <div className="lab-button-row">
            {HEAT_VARIANTS.map((v) => (
              <button
                key={v}
                type="button"
                className={`chip ${variant === v ? 'chip-active' : ''}`}
                onClick={() => onSetEdgeVariant(selectedEdge.id, v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="lab-field">
          <span>Thickness</span>
          <div className="lab-button-row">
            {EDGE_THICKNESSES.map((step) => (
              <button
                key={step}
                type="button"
                className={`chip ${thickness === step ? 'chip-active' : ''}`}
                onClick={() => onSetEdgeThickness(selectedEdge.id, step)}
              >
                {step}
              </button>
            ))}
          </div>
        </div>
        {variant === 'heat-flow' ? (
          <div className="lab-field">
            <span>Flow direction</span>
            <div className="lab-button-row">
              <button
                type="button"
                className={`chip ${direction === 'reverse' ? 'chip-active' : ''}`}
                onClick={() => onReverseEdgeDirection(selectedEdge.id)}
              >
                {direction === 'reverse' ? 'reversed' : 'reverse'}
              </button>
            </div>
          </div>
        ) : null}
        <button type="button" className="lab-danger" onClick={() => onDeleteEdge(selectedEdge.id)}>
          Delete edge
        </button>
      </aside>
    )
  }

  return (
    <aside className="lab-inspector lab-inspector-empty">
      <h2 className="lab-panel-title">Inspector</h2>
      <p>Select a node or edge to edit its style.</p>
    </aside>
  )
}
