import { useRef, useState, type ChangeEvent } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { classNameForKind, type NodeKind } from './nodeKinds'
import { HEAT_VARIANTS, type HeatVariant } from './heatVariants'
import { EDGE_THICKNESSES, resolveDirection, resolveThickness, type EdgeThickness } from './edgeStyle'
import { IMAGE_SIZE_WARNING_BYTES, IMAGE_UPLOAD_ACCEPT, readImageFile } from './imageUpload'
import { resolveTextSize, TEXT_SIZES, type TextSize } from './textSizes'
import type { EdgeMetrics, EdgeSimConfig, HostNodeSim, NodeMetrics, NodeSim } from '../engine/ports'
import type { RunStatus } from '../sim/workerProtocol'
import { HostCapabilityFields, HostScalingFields } from './hostConfigFields'
import { EdgeConfigFields } from './edgeConfigFields'
import { FormulaPanel } from './FormulaPanel'
import { InspectorSection } from './InspectorSection'

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
        overloadBehavior: 'collapse',
        minReplicas: 1,
        maxReplicas: 1,
        bootDelayMs: 8000,
        highWatermark: 0.8,
        lowWatermark: 0.3,
      }
  }
}

// Fase 3 (consciencia de estado): while the sim is running/paused, the ~10
// disabled capability+scaling inputs collapse into this single read-only
// line instead of rendering as dead controls (plan.md Fase 3).
function hostSpecLine(sim: HostNodeSim): string {
  if (sim.profile === 'client_pool') return `${sim.requestRatePerSec} req/s`
  if (sim.profile === 'external_api') return `${sim.manualBaselineLatencyMs}ms latency`
  const capability =
    sim.configMode === 'manual'
      ? `manual · ${sim.manualSaturationRPS} sat / ${sim.manualMaxRPS} max / ${sim.manualBaselineLatencyMs}ms`
      : `calculated · ${sim.cpuProcessingTimeMs}ms cpu / ${sim.maxWorkerThreads} threads`
  return `${capability} · replicas ${sim.minReplicas}–${sim.maxReplicas} · ${sim.overloadBehavior}`
}

type HostAndQueueFieldsProps = {
  node: Node
  metrics: NodeMetrics | undefined
  runStatus: RunStatus
  onSetNodeSim: (id: string, sim: NodeSim | undefined) => void
}

// Extracted so Inspector renders this with `key={node.id}`, remounting (and
// so resetting its hooks) whenever the selected node changes.
//
// Every section is an accordion (InspectorSection) with runStatus-aware
// defaults: idle opens ROLE & CAPABILITY (the editing task), running/paused
// opens TELEMETRY and FORMULAS (the reading task) and promotes them above
// ROLE & CAPABILITY. No animated reorder — a plain render-order swap.
function HostAndQueueFields({ node, metrics, runStatus, onSetNodeSim }: HostAndQueueFieldsProps) {
  const sim = (node.data as { sim?: NodeSim } | undefined)?.sim
  // Editing roles/config is only allowed in edit mode (idle) — see the
  // 008-era rationale this repo has kept: sending updateTopology while
  // running triggers the auto-pause rule on every keystroke, and resuming
  // a paused run with changed config but preserved runtime state is a
  // different, murkier feature than "start a fresh run with this config".
  const canEdit = runStatus === 'idle'
  // Only the three compute profiles carry an autoscaler (data-model.md) —
  // client_pool/external_api never reach the SCALING section.
  const hasScaling = sim?.kind === 'host' && sim.profile !== 'client_pool' && sim.profile !== 'external_api'

  const handleKindChange = (choice: SimKindChoice) => {
    onSetNodeSim(node.id, defaultSimForChoice(choice))
  }

  const roleAndCapability = (
    <InspectorSection
      id="node-role-capability"
      title="Role & capability"
      defaultOpen={canEdit}
      // Reserved for the config-presets picker (next feature) — the summary
      // row keeps a right-hand slot so that feature is a content change,
      // not a layout change.
      summaryExtra={null}
    >
      <div className="lab-field">
        <span>Simulation role</span>
        <div className="lab-button-row lab-role-grid">
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
      </div>
      {!canEdit ? <p className="sim-placeholder-note">Reset the simulation to edit roles or config.</p> : null}
      {canEdit && sim && sim.kind === 'host' ? (
        <HostCapabilityFields sim={sim} disabled={!canEdit} onChange={(next) => onSetNodeSim(node.id, next)} />
      ) : null}
      {!canEdit && sim && sim.kind === 'host' ? <p className="lab-spec-line">{hostSpecLine(sim)}</p> : null}
    </InspectorSection>
  )

  // Own accordion section (not a subsection of ROLE & CAPABILITY): scaling
  // is second-step tuning, so it defaults collapsed to keep the idle panel
  // shallow. While running it folds into the spec line above instead.
  const scaling =
    canEdit && hasScaling && sim?.kind === 'host' ? (
      <InspectorSection id="node-scaling" title="Scaling" defaultOpen={false} summaryExtra={null}>
        <HostScalingFields sim={sim} disabled={!canEdit} onChange={(next) => onSetNodeSim(node.id, next)} />
      </InspectorSection>
    ) : null

  const telemetry = sim ? (
    <InspectorSection id="node-telemetry" title="Telemetry" defaultOpen={!canEdit} summaryExtra={null}>
      {canEdit ? (
        <p className="sim-placeholder-note">Start the simulation to read telemetry.</p>
      ) : (
        <>
          {sim.kind === 'host' ? (
            <div className="sim-host-metrics">
              <div className="sim-host-meter">
                <span>Status</span>
                <span className="sim-host-meter-value">{metrics?.host?.status ?? '—'}</span>
              </div>
              <div className="sim-host-meter">
                <span>Incoming</span>
                <span className="sim-host-meter-value">{metrics?.host ? `${metrics.host.incomingRPS.toFixed(1)} req/s` : '—'}</span>
              </div>
              <div className="sim-host-meter">
                <span>Forwarded</span>
                <span className="sim-host-meter-value">{metrics?.host ? `${metrics.host.forwardedRPS.toFixed(1)} req/s` : '—'}</span>
              </div>
              <div className="sim-host-meter">
                <span>Shed</span>
                <span className="sim-host-meter-value">{metrics?.host ? `${metrics.host.shedRPS.toFixed(1)} req/s` : '—'}</span>
              </div>
              <div className="sim-host-meter">
                <span>Saturation</span>
                <span className="sim-host-meter-value">
                  {metrics?.host ? `${(metrics.host.saturationRatio * 100).toFixed(0)}%` : '—'}
                </span>
              </div>
              <div className="sim-host-meter">
                <span>Latency</span>
                <span className="sim-host-meter-value">{metrics?.host ? `${metrics.host.latencyMs.toFixed(1)} ms` : '—'}</span>
              </div>
            </div>
          ) : null}
          {/* Replica telemetry + scaling event history (feature 013, SC-005) —
              only rendered for saturating profiles that actually carry a
              replicas block (client_pool/external_api never do). */}
          {sim.kind === 'host' && metrics?.host?.replicas ? (
            <div className="sim-host-metrics">
              <div className="sim-host-meter">
                <span>Replicas</span>
                <span className="sim-host-meter-value">{metrics.host.replicas.nominalCount}</span>
              </div>
              <div className="sim-host-meter">
                <span>Booting</span>
                <span className="sim-host-meter-value">{metrics.host.replicas.bootingCount}</span>
              </div>
              <div className="sim-host-meter">
                <span>Effective</span>
                <span className="sim-host-meter-value">{metrics.host.replicas.effectiveCount}</span>
              </div>
              <div className="sim-host-meter">
                <span>Per-replica saturation</span>
                <span className="sim-host-meter-value">{(metrics.host.replicas.perReplicaSaturation * 100).toFixed(0)}%</span>
              </div>
              {metrics.host.replicas.events.length > 0 ? (
                <ul className="sim-scaling-events">
                  {metrics.host.replicas.events.map((event, index) => (
                    <li key={`${event.simTimeMs}-${index}`}>
                      {event.direction === 'up' ? '↑' : '↓'} scaled {event.direction === 'up' ? 'up' : 'down'} to{' '}
                      {event.newCount} at t={(event.simTimeMs / 1000).toFixed(1)}s
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {sim.kind === 'queue' ? (
            <div className="sim-host-metrics">
              <div className="sim-host-meter">
                <span>Inflow</span>
                <span className="sim-host-meter-value">{metrics?.queue ? `${metrics.queue.inflowMBps.toFixed(2)} MB/s` : '—'}</span>
              </div>
              <div className="sim-host-meter">
                <span>Outflow</span>
                <span className="sim-host-meter-value">{metrics?.queue ? `${metrics.queue.outflowMBps.toFixed(2)} MB/s` : '—'}</span>
              </div>
              <div className="sim-host-meter">
                <span>Backlog</span>
                <span className="sim-host-meter-value">{metrics?.queue ? `${metrics.queue.backlogGB.toFixed(3)} GB` : '—'}</span>
              </div>
            </div>
          ) : null}
        </>
      )}
    </InspectorSection>
  ) : null

  const formulas = (
    <FormulaPanel sectionId="node-formulas" defaultOpen={!canEdit} formulaDescriptors={metrics?.formulaDescriptors} sim={sim} />
  )

  return canEdit ? (
    <>
      {roleAndCapability}
      {scaling}
      {telemetry}
      {formulas}
    </>
  ) : (
    <>
      {telemetry}
      {formulas}
      {roleAndCapability}
    </>
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
  // Must stay unconditional (Rules of Hooks) even though they're only read
  // in the node branch below; reset naturally on remount via the node's
  // `key`. The ref backs the hidden file input behind the styled "Upload
  // image" button (same pattern as App.tsx's JSON import).
  const [sizeWarningBytes, setSizeWarningBytes] = useState<number | undefined>(undefined)
  const imageInputRef = useRef<HTMLInputElement>(null)

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
        <HostAndQueueFields node={selectedNode} metrics={selectedNodeMetrics} runStatus={runStatus} onSetNodeSim={onSetNodeSim} />
        <InspectorSection id="node-appearance" title="Appearance" defaultOpen={false} summaryExtra={null}>
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
              <>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept={IMAGE_UPLOAD_ACCEPT}
                  className="lab-upload-input"
                  onChange={handleImageChange}
                />
                <button type="button" className="lab-image-upload" onClick={() => imageInputRef.current?.click()}>
                  Upload image…
                </button>
              </>
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
        </InspectorSection>
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
        <InspectorSection id="edge-style" title="Style" defaultOpen={canEditSimConfig} summaryExtra={null}>
          <div className="lab-field">
            <span>Line</span>
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
        </InspectorSection>
        <InspectorSection id="edge-traffic" title="Traffic" defaultOpen={canEditSimConfig} summaryExtra={null}>
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
        </InspectorSection>
        {simConfig ? (
          <InspectorSection id="edge-telemetry" title="Telemetry" defaultOpen={!canEditSimConfig} summaryExtra={null}>
            <div className="sim-host-metrics">
              <div className="sim-host-meter">
                <span>RPS</span>
                <span className="sim-host-meter-value">
                  {selectedEdgeMetrics?.sim ? selectedEdgeMetrics.sim.currentRPS.toFixed(1) : '—'}
                </span>
              </div>
              <div className="sim-host-meter">
                <span>MB/s</span>
                <span className="sim-host-meter-value">
                  {selectedEdgeMetrics?.sim ? selectedEdgeMetrics.sim.currentMBps.toFixed(2) : '—'}
                </span>
              </div>
              <div className="sim-host-meter">
                <span>Connections</span>
                <span className="sim-host-meter-value">
                  {selectedEdgeMetrics?.sim ? selectedEdgeMetrics.sim.activeConnections.toFixed(1) : '—'}
                </span>
              </div>
              <div className="sim-host-meter">
                <span>Congested</span>
                <span className="sim-host-meter-value">
                  {selectedEdgeMetrics?.sim ? (selectedEdgeMetrics.sim.isCongested ? 'yes' : 'no') : '—'}
                </span>
              </div>
            </div>
          </InspectorSection>
        ) : null}
        {simConfig ? (
          <FormulaPanel
            sectionId="edge-formulas"
            defaultOpen={!canEditSimConfig}
            formulaDescriptors={selectedEdgeMetrics?.formulaDescriptors}
            sim={undefined}
          />
        ) : null}
        <div className="lab-inspector-footer">
          <button type="button" className="lab-danger" onClick={() => onDeleteEdge(selectedEdge.id)}>
            Delete edge
          </button>
        </div>
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
