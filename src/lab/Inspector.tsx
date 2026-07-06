import { useState, type ChangeEvent } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { classNameForKind, type NodeKind } from './nodeKinds'
import { HEAT_VARIANTS, type HeatVariant } from './heatVariants'
import { EDGE_THICKNESSES, resolveDirection, resolveThickness, type EdgeThickness } from './edgeStyle'
import { IMAGE_SIZE_WARNING_BYTES, IMAGE_UPLOAD_ACCEPT, readImageFile } from './imageUpload'
import { resolveTextSize, TEXT_SIZES, type TextSize } from './textSizes'
import type { EdgeMetrics, EdgeSimConfig, NodeMetrics, NodeSim } from '../engine/ports'
import type { RunStatus } from '../sim/workerProtocol'
import { HostConfigFields } from './hostConfigFields'
import { EdgeConfigFields } from './edgeConfigFields'
import { FormulaPanel } from './FormulaPanel'

const NODE_KINDS: NodeKind[] = ['default', 'active', 'dim']

const SIM_KIND_CHOICES = [
  'none',
  'client_pool',
  'external_api',
  'transactional_api',
  'worker_consumer',
  'database_server',
  'queue',
] as const
type SimKindChoice = (typeof SIM_KIND_CHOICES)[number]

function simKindChoice(sim: NodeSim | undefined): SimKindChoice {
  if (!sim) return 'none'
  if (sim.kind === 'queue') return 'queue'
  return sim.profile
}

// Defaults applied the moment a profile/kind is first assigned (mirrors
// 008's generator/processor defaults). Compute profiles default to manual
// mode (data-model.md's simplest closed-form).
function defaultSimForChoice(choice: SimKindChoice): NodeSim | undefined {
  switch (choice) {
    case 'none':
      return undefined
    case 'queue':
      return { kind: 'queue' }
    case 'client_pool':
      return { kind: 'host', profile: 'client_pool', requestRatePerSec: 100 }
    case 'external_api':
      return { kind: 'host', profile: 'external_api', manualBaselineLatencyMs: 40 }
    default:
      return {
        kind: 'host',
        profile: choice,
        configMode: 'manual',
        manualBaselineLatencyMs: 10,
        manualSaturationRPS: 500,
        manualMaxRPS: 550,
      }
  }
}

type HostAndQueueFieldsProps = {
  node: Node
  metrics: NodeMetrics | undefined
  runStatus: RunStatus
  onSetNodeSim: (id: string, sim: NodeSim | undefined) => void
}

// Extracted so Inspector renders this with `key={node.id}`, remounting (and
// so resetting its hooks) whenever the selected node changes.
function HostAndQueueFields({ node, metrics, runStatus, onSetNodeSim }: HostAndQueueFieldsProps) {
  const sim = (node.data as { sim?: NodeSim } | undefined)?.sim
  // Editing roles/config is only allowed in edit mode (idle) — see the
  // 008-era rationale this repo has kept: sending updateTopology while
  // running triggers the auto-pause rule on every keystroke, and resuming
  // a paused run with changed config but preserved runtime state is a
  // different, murkier feature than "start a fresh run with this config".
  const canEdit = runStatus === 'idle'

  const handleKindChange = (choice: SimKindChoice) => {
    onSetNodeSim(node.id, defaultSimForChoice(choice))
  }

  return (
    <div className="lab-field">
      <span>Simulation role</span>
      <div className="lab-button-row">
        {SIM_KIND_CHOICES.map((choice) => (
          <button
            key={choice}
            type="button"
            disabled={!canEdit}
            className={`chip ${simKindChoice(sim) === choice ? 'chip-active' : ''}`}
            onClick={() => handleKindChange(choice)}
          >
            {choice === 'none' ? 'plain' : choice}
          </button>
        ))}
      </div>
      {!canEdit ? <p className="sim-placeholder-note">Reset the simulation to edit roles or config.</p> : null}
      {sim && sim.kind === 'host' ? (
        <HostConfigFields sim={sim} disabled={!canEdit} onChange={(next) => onSetNodeSim(node.id, next)} />
      ) : null}
      {sim && sim.kind === 'host' ? (
        <div className="sim-host-metrics">
          <span>Status: {metrics?.host?.status ?? '\u2014'}</span>
          <span>Incoming: {metrics?.host ? `${metrics.host.incomingRPS.toFixed(1)} req/s` : '\u2014'}</span>
          <span>Forwarded: {metrics?.host ? `${metrics.host.forwardedRPS.toFixed(1)} req/s` : '\u2014'}</span>
          <span>Shed: {metrics?.host ? `${metrics.host.shedRPS.toFixed(1)} req/s` : '\u2014'}</span>
          <span>Saturation: {metrics?.host ? `${(metrics.host.saturationRatio * 100).toFixed(0)}%` : '\u2014'}</span>
          <span>Latency: {metrics?.host ? `${metrics.host.latencyMs.toFixed(1)} ms` : '\u2014'}</span>
        </div>
      ) : null}
      {sim?.kind === 'queue' ? (
        <div className="sim-host-metrics">
          <span>Inflow: {metrics?.queue ? `${metrics.queue.inflowMBps.toFixed(2)} MB/s` : '\u2014'}</span>
          <span>Outflow: {metrics?.queue ? `${metrics.queue.outflowMBps.toFixed(2)} MB/s` : '\u2014'}</span>
          <span>Backlog: {metrics?.queue ? `${metrics.queue.backlogGB.toFixed(3)} GB` : '\u2014'}</span>
        </div>
      ) : null}
      <FormulaPanel formulaDescriptors={metrics?.formulaDescriptors} sim={sim} />
    </div>
  )
}

type InspectorProps = {
  selectedNode: Node | undefined
  selectedEdge: Edge | undefined
  selectedNodeMetrics: NodeMetrics | undefined
  selectedEdgeMetrics: EdgeMetrics | undefined
  runStatus: RunStatus
  onRenameNode: (id: string, label: string) => void
  onSetNodeKind: (id: string, kind: NodeKind) => void
  onSetNodeImage: (id: string, image: string | undefined, naturalWidth: number | undefined, naturalHeight: number | undefined) => void
  onSetNodeLabelSize: (id: string, size: TextSize) => void
  onSetNodeSim: (id: string, sim: NodeSim | undefined) => void
  onSetEdgeVariant: (id: string, variant: HeatVariant) => void
  onSetEdgeThickness: (id: string, thickness: EdgeThickness) => void
  onSetEdgeSimConfig: (id: string, simConfig: EdgeSimConfig | undefined) => void
  onReverseEdgeDirection: (id: string) => void
  onDeleteEdge: (id: string) => void
}

// Right-hand style/property panel for whatever is currently selected —
// mirrors the node/edge inspector panes in Langflow's canvas.
export function Inspector({
  selectedNode,
  selectedEdge,
  selectedNodeMetrics,
  selectedEdgeMetrics,
  runStatus,
  onRenameNode,
  onSetNodeKind,
  onSetNodeImage,
  onSetNodeLabelSize,
  onSetNodeSim,
  onSetEdgeVariant,
  onSetEdgeThickness,
  onSetEdgeSimConfig,
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
        <HostAndQueueFields node={selectedNode} metrics={selectedNodeMetrics} runStatus={runStatus} onSetNodeSim={onSetNodeSim} />
      </aside>
    )
  }

  if (selectedEdge) {
    const variant = ((selectedEdge.data as { variant?: HeatVariant } | undefined)?.variant) ?? 'default'
    const thickness = resolveThickness((selectedEdge.data as { thickness?: unknown } | undefined)?.thickness)
    const direction = resolveDirection((selectedEdge.data as { direction?: unknown } | undefined)?.direction)
    const simConfig = (selectedEdge.data as { simConfig?: EdgeSimConfig } | undefined)?.simConfig
    const canEditSimConfig = runStatus === 'idle'
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
        <div className="lab-field">
          <span>Traffic config</span>
          {simConfig ? (
            <EdgeConfigFields
              config={simConfig}
              disabled={!canEditSimConfig}
              onChange={(next) => onSetEdgeSimConfig(selectedEdge.id, next)}
            />
          ) : (
            <button
              type="button"
              className="chip"
              disabled={!canEditSimConfig}
              onClick={() =>
                onSetEdgeSimConfig(selectedEdge.id, {
                  trafficShareRatio: 1,
                  averagePayloadSizeKB: 1,
                  targetComputeWeightMultiplier: 1,
                  pathIoLatencyMs: 0,
                })
              }
            >
              Enable traffic config
            </button>
          )}
        </div>
        {simConfig ? (
          <div className="sim-host-metrics">
            <span>RPS: {selectedEdgeMetrics?.sim ? selectedEdgeMetrics.sim.currentRPS.toFixed(1) : '\u2014'}</span>
            <span>MB/s: {selectedEdgeMetrics?.sim ? selectedEdgeMetrics.sim.currentMBps.toFixed(2) : '\u2014'}</span>
            <span>Connections: {selectedEdgeMetrics?.sim ? selectedEdgeMetrics.sim.activeConnections.toFixed(1) : '\u2014'}</span>
            <span>Congested: {selectedEdgeMetrics?.sim ? (selectedEdgeMetrics.sim.isCongested ? 'yes' : 'no') : '\u2014'}</span>
          </div>
        ) : null}
        {simConfig ? <FormulaPanel formulaDescriptors={selectedEdgeMetrics?.formulaDescriptors} sim={undefined} /> : null}
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

