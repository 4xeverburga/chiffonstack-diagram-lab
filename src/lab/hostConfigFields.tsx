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

function integerInput(label: string, value: number, disabled: boolean, min: number, onChange: (next: number) => void) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Math.round(Number(event.target.value))
    if (Number.isFinite(parsed) && parsed >= min) onChange(parsed)
  }
  return (
    <label className="lab-field" key={label}>
      <span>{label}</span>
      <input type="number" min={min} step="1" value={value} onChange={handleChange} disabled={disabled} />
    </label>
  )
}

// Horizontal-scaling bounds + boot delay + watermarks (feature 013, FR-001;
// boot delay and watermarks promoted from internal tunables to user-facing
// capability parameters in constitution v3.2.0/v3.3.0) — the five new
// user-facing parameters closed set. maxReplicas auto-clamps >= minReplicas,
// and highWatermark auto-clamps > lowWatermark (and vice versa) on every
// edit, mirroring the manualMaxRPS >= manualSaturationRPS pattern above,
// instead of surfacing a separate validation-error message.
function AutoscalingFields({
  sim,
  disabled,
  onChange,
}: {
  sim: ComputeProfile
  disabled: boolean
  onChange: (next: HostNodeSim) => void
}) {
  return (
    <>
      {integerInput('Min replicas', sim.minReplicas, disabled, 1, (value) =>
        onChange({ ...sim, minReplicas: value, maxReplicas: Math.max(sim.maxReplicas, value) }),
      )}
      {integerInput('Max replicas', sim.maxReplicas, disabled, 1, (value) =>
        onChange({ ...sim, maxReplicas: Math.max(value, sim.minReplicas) }),
      )}
      {integerInput('Boot delay (ms)', sim.bootDelayMs, disabled, 0, (value) => onChange({ ...sim, bootDelayMs: value }))}
      {numberInput('High watermark', sim.highWatermark, disabled, 0, (value) =>
        onChange({ ...sim, highWatermark: value, lowWatermark: Math.min(sim.lowWatermark, value - 0.01) }),
      )}
      {numberInput('Low watermark', sim.lowWatermark, disabled, 0, (value) =>
        onChange({ ...sim, lowWatermark: Math.min(value, sim.highWatermark - 0.01) }),
      )}
    </>
  )
}

const OVERLOAD_BEHAVIORS = ['clamp', 'collapse'] as const

// Overload behavior (feature 012, FR-001/FR-006): the ONLY new field this
// feature adds, rendered once for both config modes (client_pool/
// external_api never reach this — HostConfigFields returns earlier for
// those profiles, so FR-006 holds with zero extra conditionals here).
function OverloadBehaviorField({
  sim,
  disabled,
  onChange,
}: {
  sim: ComputeProfile
  disabled: boolean
  onChange: (next: HostNodeSim) => void
}) {
  return (
    <div className="lab-field">
      <span>Overload behavior</span>
      <div className="lab-button-row">
        {OVERLOAD_BEHAVIORS.map((behavior) => (
          <button
            key={behavior}
            type="button"
            disabled={disabled}
            className={`chip ${sim.overloadBehavior === behavior ? 'chip-active' : ''}`}
            onClick={() => onChange({ ...sim, overloadBehavior: behavior })}
          >
            {behavior}
          </button>
        ))}
      </div>
    </div>
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
        overloadBehavior: sim.overloadBehavior,
        minReplicas: sim.minReplicas,
        maxReplicas: sim.maxReplicas,
        bootDelayMs: sim.bootDelayMs,
        highWatermark: sim.highWatermark,
        lowWatermark: sim.lowWatermark,
      })
    } else {
      onChange({
        kind: 'host',
        profile: sim.profile,
        configMode: 'calculated',
        cpuProcessingTimeMs: 16,
        maxWorkerThreads: 8,
        overloadBehavior: sim.overloadBehavior,
        minReplicas: sim.minReplicas,
        maxReplicas: sim.maxReplicas,
        bootDelayMs: sim.bootDelayMs,
        highWatermark: sim.highWatermark,
        lowWatermark: sim.lowWatermark,
      })
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
      <OverloadBehaviorField sim={sim} disabled={disabled} onChange={onChange} />
      <AutoscalingFields sim={sim} disabled={disabled} onChange={onChange} />
    </>
  )
}
