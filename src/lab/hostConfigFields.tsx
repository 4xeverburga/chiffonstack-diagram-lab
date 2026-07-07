import { useState, useEffect, type ChangeEvent } from 'react'
import type { HostNodeSim } from '../engine/ports'

type ComputeProfile = Extract<HostNodeSim, { profile: 'transactional_api' | 'worker_consumer' | 'database_server' }>

const CONFIG_MODES = ['manual', 'calculated'] as const

type NumberInputProps = {
  label: string
  value: number
  disabled: boolean
  min: number
  onChange: (next: number) => void
}

function NumberInput({ label, value, disabled, min, onChange }: NumberInputProps) {
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

function ManualComputeFields({
  sim,
  disabled,
  onChange,
}: {
  sim: Extract<ComputeProfile, { configMode: 'manual' }>
  disabled: boolean
  onChange: (next: HostNodeSim) => void
}) {
  const rpsConflict = sim.manualMaxRPS < sim.manualSaturationRPS
  return (
    <>
      <NumberInput
        label="Baseline latency (ms)"
        value={sim.manualBaselineLatencyMs}
        disabled={disabled}
        min={0}
        onChange={(value) => onChange({ ...sim, manualBaselineLatencyMs: value })}
      />
      <NumberInput
        label="Saturation RPS"
        value={sim.manualSaturationRPS}
        disabled={disabled}
        min={0}
        onChange={(value) => onChange({ ...sim, manualSaturationRPS: value })}
      />
      <NumberInput
        label="Max RPS"
        value={sim.manualMaxRPS}
        disabled={disabled}
        min={0}
        onChange={(value) => onChange({ ...sim, manualMaxRPS: value })}
      />
      {rpsConflict && <div className="lab-warning">Max RPS must be ≥ Saturation RPS</div>}
    </>
  )
}

function CalculatedComputeFields({
  sim,
  disabled,
  onChange,
}: {
  sim: Extract<ComputeProfile, { configMode: 'calculated' }>
  disabled: boolean
  onChange: (next: HostNodeSim) => void
}) {
  return (
    <>
      <NumberInput
        label="CPU processing time (ms)"
        value={sim.cpuProcessingTimeMs}
        disabled={disabled}
        min={0}
        onChange={(value) => onChange({ ...sim, cpuProcessingTimeMs: value })}
      />
      <NumberInput
        label="Max worker threads"
        value={sim.maxWorkerThreads}
        disabled={disabled}
        min={0}
        onChange={(value) => onChange({ ...sim, maxWorkerThreads: value })}
      />
    </>
  )
}

// Inspector config UI for host nodes (US2, FR-020): the profile/mode
// selector lives in Inspector.tsx (same chip-row pattern as every other
// closed choice in this app); this file renders exactly the FR-020 fields
// for the current profile/mode combination — no other inputs (SC-008).
type HostConfigFieldsProps = {
  sim: HostNodeSim
  disabled: boolean
  onChange: (next: HostNodeSim) => void
}

export function HostConfigFields({ sim, disabled, onChange }: HostConfigFieldsProps) {
  if (sim.profile === 'client_pool') {
    return (
      <NumberInput
        label="Rate (req/s)"
        value={sim.requestRatePerSec}
        disabled={disabled}
        min={0}
        onChange={(value) => onChange({ ...sim, requestRatePerSec: value })}
      />
    )
  }
  if (sim.profile === 'external_api') {
    return (
      <NumberInput
        label="Baseline latency (ms)"
        value={sim.manualBaselineLatencyMs}
        disabled={disabled}
        min={0}
        onChange={(value) => onChange({ ...sim, manualBaselineLatencyMs: value })}
      />
    )
  }

  const handleModeChange = (mode: (typeof CONFIG_MODES)[number]) => {
    if (mode === sim.configMode) return
    if (mode === 'manual') {
      onChange({
        kind: 'host',
        profile: sim.profile,
        configMode: 'manual',
        manualBaselineLatencyMs: 10,
        manualSaturationRPS: 500,
        manualMaxRPS: 550,
      })
    } else {
      onChange({ kind: 'host', profile: sim.profile, configMode: 'calculated', cpuProcessingTimeMs: 16, maxWorkerThreads: 8 })
    }
  }

  return (
    <>
      <div className="lab-field">
        <span>Config mode</span>
        <div className="lab-button-row">
          {CONFIG_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              className={`chip ${sim.configMode === mode ? 'chip-active' : ''}`}
              onClick={() => handleModeChange(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      {sim.configMode === 'manual' ? (
        <ManualComputeFields sim={sim} disabled={disabled} onChange={onChange} />
      ) : (
        <CalculatedComputeFields sim={sim} disabled={disabled} onChange={onChange} />
      )}
    </>
  )
}
