// Web Worker entry point: hosts the pure engine (createSimulation) behind
// the worker protocol (contracts/engine-ports.md). This file — like
// useSimulation.ts and store.ts — is an adapter: it may import the engine,
// but nothing in src/engine/ may import from here (constitution Principle
// IV, enforced by the oxlint override on src/engine/**).
import { createSimulation } from '../engine/simulation'
import { mulberry32, PoissonTrafficSource } from '../engine/poisson'
import { CycleError, type MetricsWindow, type Simulation } from '../engine/ports'
import { SIM_TICK_MS } from '../engine/config'
import type { FromWorker, ToWorker } from './workerProtocol'

let simulation: Simulation | undefined
let intervalId: ReturnType<typeof setInterval> | undefined
let isRunning = false

// self.postMessage's DOM typing (Window's cross-document variant) doesn't
// match a dedicated worker's simpler (message, transfer?) signature — cast
// once here rather than pulling in the "webworker" lib (which conflicts
// with the "DOM" lib already required by the rest of the app, see
// tsconfig.app.json).
function post(message: FromWorker): void {
  ;(self as unknown as { postMessage: (message: FromWorker) => void }).postMessage(message)
}

function errorMessage(error: unknown): string {
  if (error instanceof CycleError) return error.message
  return error instanceof Error ? error.message : 'Simulation error.'
}

function stopTicking(): void {
  if (intervalId === undefined) return
  clearInterval(intervalId)
  intervalId = undefined
}

function startTicking(): void {
  stopTicking()
  intervalId = setInterval(() => {
    simulation?.tick(SIM_TICK_MS)
  }, SIM_TICK_MS)
}

self.addEventListener('message', (event) => {
  const message = (event as MessageEvent<ToWorker>).data

  if (message.type === 'init') {
    const metricsSink = {
      emitWindow: (window: MetricsWindow) => post({ type: 'window', window }),
    }
    simulation = createSimulation(new PoissonTrafficSource(mulberry32(message.seed)), metricsSink, message.windowSizeMs)
    isRunning = false
    stopTicking()
    try {
      simulation.loadTopology(message.topology)
      post({ type: 'status', status: 'idle' })
    } catch (error) {
      post({ type: 'status', status: 'error', message: errorMessage(error) })
    }
    return
  }

  if (!simulation) return

  switch (message.type) {
    case 'start': {
      simulation.start()
      isRunning = true
      startTicking()
      post({ type: 'status', status: 'running' })
      break
    }
    case 'pause': {
      simulation.pause()
      isRunning = false
      stopTicking()
      post({ type: 'status', status: 'paused' })
      break
    }
    case 'reset': {
      simulation.reset()
      isRunning = false
      stopTicking()
      post({ type: 'status', status: 'idle' })
      break
    }
    case 'updateTopology': {
      // Auto-pause rule (contracts/engine-ports.md): a structural edit
      // while running pauses first (with a notice), then applies.
      const wasRunning = isRunning
      if (wasRunning) {
        simulation.pause()
        isRunning = false
        stopTicking()
        post({ type: 'status', status: 'paused', message: 'Simulation paused: the topology changed while running.' })
      }
      try {
        simulation.loadTopology(message.topology)
        if (!wasRunning) post({ type: 'status', status: 'idle' })
      } catch (error) {
        post({ type: 'status', status: 'error', message: errorMessage(error) })
      }
      break
    }
    default:
      break
  }
})
