import type { ReactElement } from 'react'
import type { NodeMetrics, SimRole } from '../engine/ports'
import { resolveKafkaHardwareProfile } from '../engine/kafkaCatalog'
import { deriveBindingResource } from './kafkaBindingResource'
import { formatDualUnitLabel } from './dualUnitLabel'

// Hover-triggered detail popover beside a simulated node: the node itself
// only ever needs to carry the minimal always-visible signal FR-006
// requires (the border color/style/blink treatment in App.css) —
// everything else a user might want (rates, saturation meters, lag,
// binding constraint, the producer's native-rate/MB-per-second dual-unit
// reading) lives here instead, one hover away, without opening the
// Inspector or permanently occupying canvas space. Pure CSS :hover/
// :focus-within reveal (App.css) — no JS hover-state needed, consistent
// with the rest of the app's flat/CSS-driven interaction model.
type NodeInfoButtonProps = {
  sim: SimRole
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

function renderRoleConfig(sim: SimRole): ReactElement[] {
  switch (sim.role) {
    case 'generator':
      return [formatRow('Rate', `${sim.ratePerSec} req/s`)]
    case 'processor':
      return [formatRow('Service rate', `${sim.serviceRatePerSec} req/s`)]
    case 'sink':
      return []
    case 'producer': {
      const mbPerSec = (sim.messageRatePerSec * sim.averagePayloadBytes) / 1_000_000
      return [
        formatRow('Message rate', `${sim.messageRatePerSec} msg/s`),
        formatRow('Avg payload', `${sim.averagePayloadBytes} bytes`),
        formatRow('\u2248 dual-unit', formatDualUnitLabel(sim.messageRatePerSec, mbPerSec)),
      ]
    }
    case 'consumer':
      return [formatRow('Consume rate', `${sim.consumeRatePerSec} msg/s`)]
    case 'kafka': {
      const profile = resolveKafkaHardwareProfile(sim.hardwareProfile)
      return [
        formatRow('Hardware', profile.id),
        formatRow('Partitions', String(sim.partitions)),
        formatRow('Replication', String(sim.replicationFactor)),
        formatRow('TLS', sim.tlsEnabled ? 'on' : 'off'),
        formatRow('Compression', sim.compression),
      ]
    }
    default:
      return []
  }
}

function renderKafkaMetrics(metrics: NodeMetrics | undefined): ReactElement[] {
  const kafka = metrics?.kafka
  if (!kafka) return [formatRow('Status', 'no data')]
  const binding = deriveBindingResource(metrics?.formulaDescriptors)
  return [
    formatRow('Status', kafka.status),
    formatRow('Ingress', `${kafka.ingressMBps.toFixed(2)} MB/s`),
    formatRow('Egress', `${kafka.egressMBps.toFixed(2)} MB/s`),
    formatRow('Network', `${(kafka.saturation.network * 100).toFixed(0)}%${binding === 'network' ? ' (binding)' : ''}`),
    formatRow('CPU', `${(kafka.saturation.cpu * 100).toFixed(0)}%${binding === 'cpu' ? ' (binding)' : ''}`),
    formatRow('Disk', `${(kafka.saturation.disk * 100).toFixed(0)}%${binding === 'disk' ? ' (binding)' : ''}`),
    formatRow('Lag', `${kafka.consumerLagMessages.toFixed(0)} msgs`),
    formatRow('Cache hit', `${(kafka.pageCacheHitRatio * 100).toFixed(0)}%`),
  ]
}

function renderGenericThroughput(sim: SimRole, metrics: NodeMetrics | undefined): ReactElement[] {
  if (sim.role === 'kafka') return []
  const rows = [formatRow('Throughput', metrics ? `${metrics.throughputPerSec.toFixed(1)} req/s` : '—')]
  if (sim.role === 'processor') rows.push(formatRow('Queue depth', metrics ? metrics.queueDepth.toFixed(1) : '—'))
  return rows
}

export function NodeInfoButton({ sim, metrics }: NodeInfoButtonProps) {
  return (
    <div className="node-info-button-wrapper nodrag nopan">
      <button type="button" className="node-info-button" aria-label={`${sim.role} simulation details`}>
        i
      </button>
      <div className="node-info-popover" role="tooltip">
        <div className="node-info-popover-title">{sim.role}</div>
        {renderRoleConfig(sim)}
        {sim.role === 'kafka' ? renderKafkaMetrics(metrics) : renderGenericThroughput(sim, metrics)}
      </div>
    </div>
  )
}
