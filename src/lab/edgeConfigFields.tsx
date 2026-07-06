import type { ChangeEvent } from 'react'
import type { EdgeSimConfig } from '../engine/ports'

type EdgeConfigFieldsProps = {
  config: EdgeSimConfig
  disabled: boolean
  /** Sum of trafficShareRatio across every outbound edge from this edge's
   *  source, including this edge \u2014 used only to show the share-
   *  normalization hint (data-model.md: shares are normalized per source
   *  at load time when they don't already sum to 1). */
  siblingShareTotal: number
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
// no other inputs (SC-008).
export function EdgeConfigFields({ config, disabled, siblingShareTotal, onChange }: EdgeConfigFieldsProps) {
  const needsNormalization = Math.abs(siblingShareTotal - 1) > 0.001
  return (
    <>
      {numberField('Traffic share ratio', config.trafficShareRatio, disabled, 0, (value) =>
        onChange({ ...config, trafficShareRatio: value }),
      )}
      {needsNormalization ? (
        <p className="sim-placeholder-note">
          This source's outgoing shares sum to {siblingShareTotal.toFixed(2)} {'\u2014'} they will be normalized to sum to 1 when
          simulated.
        </p>
      ) : null}
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
