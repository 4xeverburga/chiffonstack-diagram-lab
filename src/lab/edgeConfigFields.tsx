import { useState, useEffect, type ChangeEvent } from 'react'
import type { EdgeSimConfig } from '../engine/ports'

type EdgeConfigFieldsProps = {
  config: EdgeSimConfig
  disabled: boolean
  onChange: (next: EdgeSimConfig) => void
}

type NumberFieldProps = {
  label: string
  value: number
  disabled: boolean
  min: number
  onChange: (next: number) => void
}

function NumberField({ label, value, disabled, min, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    setDraft(text)
    const parsed = Number(text)
    if (Number.isFinite(parsed) && parsed >= min) onChange(parsed)
  }

  const handleBlur = () => {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed) || parsed < min) setDraft(String(value))
  }

  return (
    <label className="lab-field">
      <span>{label}</span>
      <input type="number" min={min} step="any" value={draft} onChange={handleChange} onBlur={handleBlur} disabled={disabled} />
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
      <NumberField
        label="Traffic share ratio"
        value={config.trafficShareRatio}
        disabled={disabled}
        min={0}
        onChange={(value) => onChange({ ...config, trafficShareRatio: value })}
      />
      <p className="sim-placeholder-note">
        Not normalized against sibling edges: 1.0 means this call happens for every upstream request (use this on every edge for a
        sequential/broadcast fan-out); split traffic across a few edges (e.g. 0.7 and 0.3) to model a conditional branch instead.
      </p>
      <NumberField
        label="Average payload size (KB)"
        value={config.averagePayloadSizeKB}
        disabled={disabled}
        min={0}
        onChange={(value) => onChange({ ...config, averagePayloadSizeKB: value })}
      />
      <NumberField
        label="Target compute weight multiplier"
        value={config.targetComputeWeightMultiplier}
        disabled={disabled}
        min={0.001}
        onChange={(value) => onChange({ ...config, targetComputeWeightMultiplier: value })}
      />
      <NumberField
        label="Path I/O latency (ms)"
        value={config.pathIoLatencyMs}
        disabled={disabled}
        min={0}
        onChange={(value) => onChange({ ...config, pathIoLatencyMs: value })}
      />
    </>
  )
}
