import type { ChangeEvent } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { classNameForKind, type NodeKind } from './nodeKinds'
import { HEAT_VARIANTS, type HeatVariant } from './heatVariants'

const NODE_KINDS: NodeKind[] = ['default', 'active', 'dim']

type InspectorProps = {
  selectedNode: Node | undefined
  selectedEdge: Edge | undefined
  onRenameNode: (id: string, label: string) => void
  onSetNodeKind: (id: string, kind: NodeKind) => void
  onSetNodeImage: (id: string, image: string | undefined) => void
  onSetEdgeVariant: (id: string, variant: HeatVariant) => void
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
  onDeleteEdge,
}: InspectorProps) {
  if (selectedNode) {
    const label = typeof selectedNode.data.label === 'string' ? selectedNode.data.label : ''
    const image = typeof selectedNode.data.image === 'string' ? selectedNode.data.image : undefined

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') onSetNodeImage(selectedNode.id, reader.result)
      }
      reader.readAsDataURL(file)
      event.target.value = ''
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
            <input type="file" accept="image/png,image/svg+xml" onChange={handleImageChange} />
          )}
        </div>
      </aside>
    )
  }

  if (selectedEdge) {
    const variant = ((selectedEdge.data as { variant?: HeatVariant } | undefined)?.variant) ?? 'default'
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
