import type { RunStatus } from '../sim/workerProtocol'

type SimulationControlsProps = {
  runStatus: RunStatus
  statusMessage: string | undefined
  hasGenerator: boolean
  onStart: () => void
  onPause: () => void
  onReset: () => void
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
  onStart,
  onPause,
  onReset,
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
      {!hasGenerator ? (
        <span className="sim-controls-message">Add a load generator node to start the simulation.</span>
      ) : null}
      {statusMessage && (runStatus === 'error' || runStatus === 'paused') ? (
        <span className={`sim-controls-message${runStatus === 'error' ? ' sim-controls-error' : ''}`}>{statusMessage}</span>
      ) : null}
    </div>
  )
}
