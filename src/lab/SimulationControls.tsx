import type { RunStatus } from '../sim/workerProtocol'
import { TRAFFIC_SCALE_LABELS, type TrafficScale } from './animation/trafficScalePresets'

type SimulationControlsProps = {
  runStatus: RunStatus
  statusMessage: string | undefined
  hasGenerator: boolean
  trafficScale: TrafficScale
  onStart: () => void
  onPause: () => void
  onReset: () => void
  onChangeTrafficScale: (scale: TrafficScale) => void
}

// Persistent Start/Pause/Reset bar (FR-003) — replaces ExportBar's slot at
// the top of the canvas (constitution: legacy export pipeline removed,
// FR-010). Surfaces the two guard-rail messages from spec's edge cases:
// no generator in the topology, and the worker's auto-pause/error notices
// (contracts/engine-ports.md status messages).
export function SimulationControls({
  runStatus,
  statusMessage,
  hasGenerator,
  trafficScale,
  onStart,
  onPause,
  onReset,
  onChangeTrafficScale,
}: SimulationControlsProps) {
  const canStart = hasGenerator && runStatus !== 'running'
  const canPause = runStatus === 'running'

  return (
    <div className="lab-topbar sim-controls">
      <div className="sim-controls-buttons">
        <button type="button" onClick={onStart} disabled={!canStart}>
          Start
        </button>
        <button type="button" onClick={onPause} disabled={!canPause}>
          Pause
        </button>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>
      <label className="sim-scale-select">
        <span>Peak traffic</span>
        <select value={trafficScale} onChange={(event) => onChangeTrafficScale(event.target.value as TrafficScale)}>
          {(Object.keys(TRAFFIC_SCALE_LABELS) as TrafficScale[]).map((scale) => (
            <option key={scale} value={scale}>
              {TRAFFIC_SCALE_LABELS[scale]}
            </option>
          ))}
        </select>
      </label>
      {!hasGenerator ? (
        <span className="sim-controls-message">Add a load generator or producer node to start the simulation.</span>
      ) : null}
      {statusMessage && (runStatus === 'error' || runStatus === 'paused') ? (
        <span className={`sim-controls-message${runStatus === 'error' ? ' sim-controls-error' : ''}`}>{statusMessage}</span>
      ) : null}
    </div>
  )
}
