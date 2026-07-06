import type { KafkaNodeMetrics } from '../engine/ports'
import { deriveBindingResource, type BindingResource } from './kafkaBindingResource'
import type { FormulaDescriptor } from '../engine/ports'

// Live Kafka health readout for the Inspector (US2, FR-004/FR-005):
// ingress/egress throughput, the three saturation meters, consumer lag,
// page cache hit ratio, and the status badge. `bindingResource` is derived
// from the same `formulaDescriptors` array FormulaPanel reads, so the two
// panels always agree on which resource is binding (FR-005) by
// construction rather than by coincidence.
type KafkaMetricsPanelProps = {
  metrics: KafkaNodeMetrics | undefined
  formulaDescriptors: FormulaDescriptor[] | undefined
}

function meterRow(label: string, resource: Exclude<BindingResource, undefined>, ratio: number | undefined, binding: BindingResource) {
  const isBinding = binding === resource
  return (
    <div className={`sim-kafka-meter ${isBinding ? 'sim-kafka-meter-binding' : ''}`}>
      <span>
        {label}
        {isBinding ? ' (binding)' : ''}
      </span>
      <span>{ratio !== undefined ? `${(ratio * 100).toFixed(0)}%` : '—'}</span>
    </div>
  )
}

export function KafkaMetricsPanel({ metrics, formulaDescriptors }: KafkaMetricsPanelProps) {
  const bindingResource = deriveBindingResource(formulaDescriptors)

  return (
    <div className="sim-kafka-metrics">
      <div className={`sim-status-badge ${metrics ? `sim-status-badge-${metrics.status}` : ''}`}>
        {metrics ? metrics.status : 'no data'}
      </div>
      <div className="sim-metrics-readout">
        <span>Ingress: {metrics ? `${metrics.ingressMBps.toFixed(2)} MB/s` : '—'}</span>
        <span>Egress: {metrics ? `${metrics.egressMBps.toFixed(2)} MB/s` : '—'}</span>
      </div>
      {meterRow('Network saturation', 'network', metrics?.saturation.network, bindingResource)}
      {meterRow('CPU saturation', 'cpu', metrics?.saturation.cpu, bindingResource)}
      {meterRow('Disk saturation', 'disk', metrics?.saturation.disk, bindingResource)}
      <div className="sim-metrics-readout">
        <span>Consumer lag: {metrics ? `${metrics.consumerLagMessages.toFixed(0)} msgs (${metrics.consumerLagBytes.toFixed(0)} bytes)` : '—'}</span>
        <span>Page cache hit ratio: {metrics ? `${(metrics.pageCacheHitRatio * 100).toFixed(0)}%` : '—'}</span>
      </div>
    </div>
  )
}
