import type { MetricsWindow, SimTopology } from 'sugar-skills'

// Discriminated unions over postMessage (structured clone) — the adapter
// boundary between the UI thread and the worker hosting the engine
// (contracts/engine-ports.md "Worker protocol").

export type ToWorker =
  | { type: 'init'; topology: SimTopology; windowSizeMs: number; seed: number }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'reset' }
  | { type: 'updateTopology'; topology: SimTopology }

export type RunStatus = 'idle' | 'running' | 'paused' | 'error'

export type FromWorker =
  | { type: 'window'; window: MetricsWindow }
  | { type: 'status'; status: RunStatus; message?: string }
