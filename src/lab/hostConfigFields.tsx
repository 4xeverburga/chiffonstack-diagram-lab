import type { ChangeEvent } from 'react'
import type { HostNodeSim } from '../engine/ports'

type ComputeProfile = Extract<HostNodeSim, { profile: 'transactional_api' | 'worker_consumer' | 'database_server' }>

const CONFIG_MODES = ['manual', 'calculated'] as const

function numberInput(
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

function ManualComputeFields({
  sim,
  disabled,
  onChange,
}: {
  sim: Extract<ComputeProfile, { configMode: 'manual' }>
  disabled: boolean
  onChange: (next: HostNodeSim) => void
}) {
  return (
    <>
      {numberInput('Baseline latency (ms)', sim.manualBaselineLatencyMs, disabled, 0, (value) =>
        onChange({ ...sim, manualBaselineLatencyMs: value }),
      )}
      {numberInput('Saturation RPS', sim.manualSaturationRPS, disabled, 0, (value) =>
        onChange({ ...sim, manualSaturationRPS: value, manualMaxRPS: Math.max(sim.manualMaxRPS, value) }),
      )}
      {numberInput('Max RPS', sim.manualMaxRPS, disabled, 0, (value) =>
        onChange({ ...sim, manualMaxRPS: Math.max(value, sim.manualSaturationRPS) }),
      )}
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
      {numberInput('CPU processing time (ms)', sim.cpuProcessingTimeMs, disabled, 0, (value) =>
        onChange({ ...sim, cpuProcessingTimeMs: value }),
      )}
      {numberInput('Max worker threads', sim.maxWorkerThreads, disabled, 0, (value) => onChange({ ...sim, maxWorkerThreads: value }))}
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
    return numberInput('Rate (req/s)', sim.requestRatePerSec, disabled, 0, (value) => onChange({ ...sim, requestRatePerSec: value }))
  }
  if (sim.profile === 'external_api') {
    return numberInput('Baseline latency (ms)', sim.manualBaselineLatencyMs, disabled, 0, (value) =>
      onChange({ ...sim, manualBaselineLatencyMs: value }),
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
