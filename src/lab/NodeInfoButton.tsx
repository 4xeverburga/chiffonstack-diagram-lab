import type { ReactElement } from 'react'
import type { NodeMetrics, NodeSim } from '../engine/ports'

// Hover-triggered detail popover beside a simulated node: the node itself
// only ever needs to carry the minimal always-visible signal FR-013
// requires (the border color/style/blink treatment in App.css) —
// everything else a user might want (config values, incoming/forwarded
// rate, saturation, latency, shed traffic, queue backlog) lives here
// instead, one hover away, without opening the Inspector or permanently
// occupying canvas space. Pure CSS :hover/:focus-within reveal (App.css) —
// no JS hover-state needed, consistent with the rest of the app's flat/
// CSS-driven interaction model.
type NodeInfoButtonProps = {
  sim: NodeSim
  metrics: NodeMetrics | undefined
}

function formatRow(label: string, value: string): ReactElement {
  return (
    <div className="node-info-row" key={label}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function renderRoleConfig(sim: NodeSim): ReactElement[] {
  if (sim.kind === 'queue') return []
  if (sim.profile === 'client_pool') return [formatRow('Rate', `${sim.requestRatePerSec} req/s`)]
  if (sim.profile === 'external_api') return [formatRow('Baseline latency', `${sim.manualBaselineLatencyMs} ms`)]
  if (sim.configMode === 'manual') {
    return [
      formatRow('Baseline latency', `${sim.manualBaselineLatencyMs} ms`),
      formatRow('Saturation RPS', `${sim.manualSaturationRPS}`),
      formatRow('Max RPS', `${sim.manualMaxRPS}`),
    ]
  }
  return [
    formatRow('CPU time', `${sim.cpuProcessingTimeMs} ms`),
    formatRow('Worker threads', `${sim.maxWorkerThreads}`),
  ]
}

function renderHostMetrics(metrics: NodeMetrics | undefined): ReactElement[] {
  const host = metrics?.host
  if (!host) return [formatRow('Status', 'no data')]
  return [
    formatRow('Status', host.status),
    formatRow('Incoming', `${host.incomingRPS.toFixed(1)} req/s`),
    formatRow('Forwarded', `${host.forwardedRPS.toFixed(1)} req/s`),
    formatRow('Shed', `${host.shedRPS.toFixed(1)} req/s`),
    formatRow('Saturation', `${(host.saturationRatio * 100).toFixed(0)}%`),
    formatRow('Latency', `${host.latencyMs.toFixed(1)} ms`),
  ]
}

function renderQueueMetrics(metrics: NodeMetrics | undefined): ReactElement[] {
  const queue = metrics?.queue
  if (!queue) return [formatRow('Status', 'no data')]
  return [
    formatRow('Inflow', `${queue.inflowMBps.toFixed(2)} MB/s`),
    formatRow('Outflow', `${queue.outflowMBps.toFixed(2)} MB/s`),
    formatRow('Backlog', `${queue.backlogGB.toFixed(3)} GB`),
  ]
}

export function NodeInfoButton({ sim, metrics }: NodeInfoButtonProps) {
  const title = sim.kind === 'queue' ? 'queue' : sim.profile
  return (
    <div className="node-info-button-wrapper nodrag nopan">
      <button type="button" className="node-info-button" aria-label={`${title} simulation details`}>
        i
      </button>
      <div className="node-info-popover" role="tooltip">
        <div className="node-info-popover-title">{title}</div>
        {renderRoleConfig(sim)}
        {sim.kind === 'queue' ? renderQueueMetrics(metrics) : renderHostMetrics(metrics)}
      </div>
    </div>
  )
}

