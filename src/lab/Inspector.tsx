import { useState, type ChangeEvent } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { classNameForKind, type NodeKind } from './nodeKinds'
import { HEAT_VARIANTS, type HeatVariant } from './heatVariants'
import { EDGE_THICKNESSES, resolveDirection, resolveThickness, type EdgeThickness } from './edgeStyle'
import { IMAGE_SIZE_WARNING_BYTES, IMAGE_UPLOAD_ACCEPT, readImageFile } from './imageUpload'
import { resolveTextSize, TEXT_SIZES, type TextSize } from './textSizes'
import type { NodeMetrics, SimRole } from '../engine/ports'
import type { RunStatus } from '../sim/workerProtocol'

const NODE_KINDS: NodeKind[] = ['default', 'active', 'dim']

const SIM_ROLE_CHOICES = ['none', 'generator', 'processor', 'sink'] as const
type SimRoleChoice = (typeof SIM_ROLE_CHOICES)[number]

function simRoleChoice(sim: SimRole | undefined): SimRoleChoice {
  if (!sim) return 'none'
  if (sim.role === 'generator' || sim.role === 'processor' || sim.role === 'sink') return sim.role
  return 'none'
}

type SimRoleFieldsProps = {
  node: Node
  metrics: NodeMetrics | undefined
  runStatus: RunStatus
  onSetNodeSimRole: (id: string, sim: SimRole | undefined) => void
}

// Extracted so its rate-text/validation-error local state resets cleanly
// whenever the selected node changes — Inspector renders this with
// `key={node.id}`, which remounts it (and so resets its hooks) instead of
// carrying stale draft text over from a previously selected node.
function SimRoleFields({ node, metrics, runStatus, onSetNodeSimRole }: SimRoleFieldsProps) {
  const sim = (node.data as { sim?: SimRole } | undefined)?.sim
  // Editing roles/rates is only allowed in edit mode (idle) — pausing
  // isn't enough. Two reasons: (1) sending updateTopology while running
  // triggers the auto-pause rule on every keystroke
  // (contracts/engine-ports.md — meant for structural add/delete edits,
  // not live rate tuning), and (2) resuming a paused run with a changed
  // rate but preserved virtual time/queue state is a different, murkier
  // feature than "start a fresh run with this rate" — simplest and least
  // surprising is to require a full Reset back to idle before editing.
  const canEditSim = runStatus === 'idle'
  const [rateText, setRateText] = useState(() =>
    sim?.role === 'generator' ? String(sim.ratePerSec) : sim?.role === 'processor' ? String(sim.serviceRatePerSec) : '',
  )
  const [error, setError] = useState<string | undefined>(undefined)

  const handleRoleChange = (choice: SimRoleChoice) => {
    setError(undefined)
    if (choice === 'none') {
      setRateText('')
      onSetNodeSimRole(node.id, undefined)
      return
    }
    if (choice === 'sink') {
      setRateText('')
      onSetNodeSimRole(node.id, { role: 'sink' })
      return
    }
    if (choice === 'generator') {
      setRateText('100')
      onSetNodeSimRole(node.id, { role: 'generator', ratePerSec: 100 })
      return
    }
    setRateText('200')
    onSetNodeSimRole(node.id, { role: 'processor', serviceRatePerSec: 200 })
  }

  const handleRateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    setRateText(text)
    const value = Number(text)
    if (sim?.role === 'generator') {
      if (!Number.isFinite(value) || value < 0) {
        setError('Rate must be a number \u2265 0.')
        return
      }
      setError(undefined)
      onSetNodeSimRole(node.id, { role: 'generator', ratePerSec: value })
      return
    }
    if (sim?.role === 'processor') {
      if (!Number.isFinite(value) || value <= 0) {
        setError('Service rate must be a number > 0.')
        return
      }
      setError(undefined)
      onSetNodeSimRole(node.id, { role: 'processor', serviceRatePerSec: value })
    }
  }

  return (
    <div className="lab-field">
      <span>Simulation role</span>
      <div className="lab-button-row">
        {SIM_ROLE_CHOICES.map((choice) => (
          <button
            key={choice}
            type="button"
            disabled={!canEditSim}
            className={`chip ${simRoleChoice(sim) === choice ? 'chip-active' : ''}`}
            onClick={() => handleRoleChange(choice)}
          >
            {choice === 'none' ? 'plain' : choice}
          </button>
        ))}
      </div>
      {!canEditSim ? <p className="sim-placeholder-note">Reset the simulation to edit roles or rates.</p> : null}
      {sim?.role === 'generator' ? (
        <label className="lab-field">
          <span>Rate (req/s)</span>
          <input type="number" min={0} step="any" value={rateText} onChange={handleRateChange} disabled={!canEditSim} />
        </label>
      ) : null}
      {sim?.role === 'processor' ? (
        <>
          <label className="lab-field">
            <span>Service rate (req/s)</span>
            <input type="number" min={0} step="any" value={rateText} onChange={handleRateChange} disabled={!canEditSim} />
          </label>
          <p className="sim-placeholder-note">
            Placeholder (fixed rate) — no real technology model behind this node yet.
          </p>
        </>
      ) : null}
      {error ? <div className="lab-warning">{error}</div> : null}
      {sim && sim.role !== 'sink' ? (
        <div className="sim-metrics-readout">
          <span>Throughput: {metrics ? `${metrics.throughputPerSec.toFixed(1)} req/s` : '—'}</span>
          {sim.role === 'processor' ? <span>Queue depth: {metrics ? metrics.queueDepth.toFixed(1) : '—'}</span> : null}
        </div>
      ) : null}
      {sim?.role === 'sink' ? (
        <div className="sim-metrics-readout">
          <span>Throughput: {metrics ? `${metrics.throughputPerSec.toFixed(1)} req/s` : '—'}</span>
        </div>
      ) : null}
    </div>
  )
}

type InspectorProps = {
  selectedNode: Node | undefined
  selectedEdge: Edge | undefined
  selectedNodeMetrics: NodeMetrics | undefined
  runStatus: RunStatus
  onRenameNode: (id: string, label: string) => void
  onSetNodeKind: (id: string, kind: NodeKind) => void
  onSetNodeImage: (id: string, image: string | undefined, naturalWidth: number | undefined, naturalHeight: number | undefined) => void
  onSetNodeLabelSize: (id: string, size: TextSize) => void
  onSetNodeSimRole: (id: string, sim: SimRole | undefined) => void
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
  selectedNodeMetrics,
  runStatus,
  onRenameNode,
  onSetNodeKind,
  onSetNodeImage,
  onSetNodeLabelSize,
  onSetNodeSimRole,
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
    const labelSize = resolveTextSize(selectedNode.data.labelSize)

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      readImageFile(file)
        .then(({ dataUri, byteSize, naturalWidth, naturalHeight }) => {
          onSetNodeImage(selectedNode.id, dataUri, naturalWidth, naturalHeight)
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
          <span>Size</span>
          <div className="lab-button-row">
            {TEXT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={`chip ${labelSize === size ? 'chip-active' : ''}`}
                onClick={() => onSetNodeLabelSize(selectedNode.id, size)}
              >
                {size}
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
                onClick={() => onSetNodeImage(selectedNode.id, undefined, undefined, undefined)}
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
        <SimRoleFields node={selectedNode} metrics={selectedNodeMetrics} runStatus={runStatus} onSetNodeSimRole={onSetNodeSimRole} />
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
