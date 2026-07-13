import { useEffect, useState, type ChangeEvent } from 'react'
import type { HostNodeSim } from 'sugar-skills'

type ComputeProfile = Extract<HostNodeSim, { profile: 'transactional_api' | 'worker_consumer' | 'database_server' }>

const CONFIG_MODES = ['manual', 'calculated'] as const

type NumberInputProps = {
  label: string
  value: number
  disabled: boolean
  min: number
  onChange: (next: number) => void
}

// Local draft-text buffer decoupled from the committed numeric value (issue
// #5): a controlled input bound straight to `value` snaps back to the last
// valid number on every keystroke, so an intermediate state like an empty
// field or a lone leading zero can never be typed. Keeping the raw text in
// state lets the user type freely; `onChange` only fires once the draft
// parses to a finite number >= min, and `onBlur` reverts stray invalid text
// back to the last committed value.
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

// Saturation/Max RPS no longer auto-clamp each other (issue #5): forcing
// one field's value on every edit to satisfy the ordering constraint made
// it impossible to, say, lower Saturation RPS below the current Max RPS
// without first raising Max RPS. Both fields now commit whatever the user
// types and an inline `.lab-warning` (same pattern as Inspector.tsx's image
// size warning) flags the conflict until it's resolved on either side.
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
    <div className="lab-field-grid">
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
      {rpsConflict ? <div className="lab-warning">Max RPS must be ≥ Saturation RPS</div> : null}
    </div>
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
    <div className="lab-field-grid">
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
    </div>
  )
}

type IntegerInputProps = NumberInputProps

// Same draft-buffer fix as NumberInput, rounding to whole numbers on commit.
function IntegerInput({ label, value, disabled, min, onChange }: IntegerInputProps) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    setDraft(text)
    const parsed = Math.round(Number(text))
    if (Number.isFinite(parsed) && parsed >= min) onChange(parsed)
  }

  const handleBlur = () => {
    const parsed = Math.round(Number(draft))
    if (!Number.isFinite(parsed) || parsed < min) setDraft(String(value))
  }

  return (
    <label className="lab-field">
      <span>{label}</span>
      <input type="number" min={min} step="1" value={draft} onChange={handleChange} onBlur={handleBlur} disabled={disabled} />
    </label>
  )
}

// Horizontal-scaling bounds + boot delay + watermarks (feature 013, FR-001;
// boot delay and watermarks promoted from internal tunables to user-facing
// capability parameters in constitution v3.2.0/v3.3.0) — the five new
// user-facing parameters closed set. maxReplicas auto-clamps >= minReplicas,
// and highWatermark auto-clamps > lowWatermark (and vice versa) on every
// edit; unlike the manualMaxRPS/manualSaturationRPS pair above (issue #5),
// these stay auto-clamping by design rather than surfacing a warning.
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
    <div className="lab-field-grid">
      <IntegerInput
        label="Min replicas"
        value={sim.minReplicas}
        disabled={disabled}
        min={1}
        onChange={(value) => onChange({ ...sim, minReplicas: value, maxReplicas: Math.max(sim.maxReplicas, value) })}
      />
      <IntegerInput
        label="Max replicas"
        value={sim.maxReplicas}
        disabled={disabled}
        min={1}
        onChange={(value) => onChange({ ...sim, maxReplicas: Math.max(value, sim.minReplicas) })}
      />
      <IntegerInput
        label="Boot delay (ms)"
        value={sim.bootDelayMs}
        disabled={disabled}
        min={0}
        onChange={(value) => onChange({ ...sim, bootDelayMs: value })}
      />
      <NumberInput
        label="High watermark"
        value={sim.highWatermark}
        disabled={disabled}
        min={0}
        onChange={(value) => onChange({ ...sim, highWatermark: value, lowWatermark: Math.min(sim.lowWatermark, value - 0.01) })}
      />
      <NumberInput
        label="Low watermark"
        value={sim.lowWatermark}
        disabled={disabled}
        min={0}
        onChange={(value) => onChange({ ...sim, lowWatermark: Math.min(value, sim.highWatermark - 0.01) })}
      />
    </div>
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
//
// Split into two exports (plan: "Inspector denso y estado-consciente" Fase
// 1) so Inspector.tsx can place them under separate ROLE & CAPABILITY /
// SCALING sections: capability fields exist for every host profile;
// scaling fields (replica bounds/boot delay/watermarks) only exist for the
// three compute profiles that carry an autoscaler.
type HostConfigFieldsProps = {
  sim: HostNodeSim
  disabled: boolean
  onChange: (next: HostNodeSim) => void
}

export function HostCapabilityFields({ sim, disabled, onChange }: HostConfigFieldsProps) {
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
    </>
  )
}

// null for client_pool/external_api (data-model.md — those two profiles
// never carry replica bounds), so Inspector.tsx can render the SCALING
// section header only when this returns something.
export function HostScalingFields({ sim, disabled, onChange }: HostConfigFieldsProps) {
  if (sim.profile === 'client_pool' || sim.profile === 'external_api') return null
  return <AutoscalingFields sim={sim} disabled={disabled} onChange={onChange} />
}
