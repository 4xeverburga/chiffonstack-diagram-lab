import type { ChangeEvent } from 'react'
import type { EdgeSimConfig } from '../engine/ports'

type EdgeConfigFieldsProps = {
  config: EdgeSimConfig
  disabled: boolean
  onChange: (next: EdgeSimConfig) => void
}

function numberField(
  label: string,
  value: number,
  disabled: boolean,
  min: number,
  onChange: (next: number) => void,
) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value)
    if (Number.isFinite(parsed) && parsed >= min) onChange(parsed)
  }
  return (
    <label className="lab-field" key={label}>
      <span>{label}</span>
      <input type="number" min={min} step="any" value={value} onChange={handleChange} disabled={disabled} />
    </label>
  )
}

// Edge config UI for exactly the four EdgeSimConfig fields (US4, FR-020) —
// no other inputs (SC-008). Traffic share ratio is an independent
// multiplier per edge, NOT normalized across a source's other outgoing
// edges (engine/components.ts's edgeTrafficShare) — a source's shares can
// sum to more or less than 1, since real systems fan out both by SPLITTING
// (e.g. 0.7/0.3 across two edges) and by BROADCASTING/sequential calls
// (e.g. 1.0 on every edge, for a host that always calls each downstream
// service per request).
export function EdgeConfigFields({ config, disabled, onChange }: EdgeConfigFieldsProps) {
  return (
    <>
      {numberField('Traffic share ratio', config.trafficShareRatio, disabled, 0, (value) =>
        onChange({ ...config, trafficShareRatio: value }),
      )}
      <p className="sim-placeholder-note">
        Not normalized against sibling edges: 1.0 means this call happens for every upstream request (use this on every edge for a
        sequential/broadcast fan-out); split traffic across a few edges (e.g. 0.7 and 0.3) to model a conditional branch instead.
      </p>
      {numberField('Average payload size (KB)', config.averagePayloadSizeKB, disabled, 0, (value) =>
        onChange({ ...config, averagePayloadSizeKB: value }),
      )}
      {numberField('Target compute weight multiplier', config.targetComputeWeightMultiplier, disabled, 0.001, (value) =>
        onChange({ ...config, targetComputeWeightMultiplier: value }),
      )}
      {numberField('Path I/O latency (ms)', config.pathIoLatencyMs, disabled, 0, (value) => onChange({ ...config, pathIoLatencyMs: value }))}
    </>
  )
}
