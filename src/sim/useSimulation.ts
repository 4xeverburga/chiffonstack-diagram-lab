import { useEffect, useMemo, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { SIM_TICK_MS } from 'sugar-skills'
import { buildSimTopology, type SimStore } from './store'
import type { FromWorker, ToWorker } from './workerProtocol'

function topologyKey(nodes: Node[], edges: Edge[]): string {
  return JSON.stringify(buildSimTopology(nodes, edges))
}

export interface SimulationActions {
  start(): void
  pause(): void
  reset(): void
}

// Adapter hook: owns the worker's lifecycle, translates React state into
// ToWorker messages, and feeds FromWorker messages into the store. Nothing
// here is exercised by the engine's own unit tests (those call
// createSimulation directly) — this hook is the seam React Flow's
// controlled nodes/edges cross to reach the worker.
export function useSimulation(store: SimStore, nodes: Node[], edges: Edge[]): SimulationActions {
  const workerRef = useRef<Worker | undefined>(undefined)
  const lastTopologyKeyRef = useRef<string | undefined>(undefined)
  const seedRef = useRef(Date.now())

  useEffect(() => {
    const worker = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<FromWorker>) => {
      const message = event.data
      if (message.type === 'window') store.getState().setWindow(message.window)
      else store.getState().setRunStatus(message.status, message.message)
    }
    const topology = buildSimTopology(nodes, edges)
    lastTopologyKeyRef.current = JSON.stringify(topology)
    const init: ToWorker = { type: 'init', topology, windowSizeMs: SIM_TICK_MS, seed: seedRef.current }
    worker.postMessage(init)
    return () => {
      worker.terminate()
      workerRef.current = undefined
    }
    // The worker is created once per store instance (App.tsx creates the
    // store once); subsequent topology changes flow through the effect
    // below rather than recreating the worker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store])

  useEffect(() => {
    const key = topologyKey(nodes, edges)
    if (key === lastTopologyKeyRef.current) return
    lastTopologyKeyRef.current = key
    const worker = workerRef.current
    if (!worker) return
    const message: ToWorker = { type: 'updateTopology', topology: buildSimTopology(nodes, edges) }
    worker.postMessage(message)
  }, [nodes, edges])

  return useMemo(
    () => ({
      start: () => workerRef.current?.postMessage({ type: 'start' } satisfies ToWorker),
      pause: () => workerRef.current?.postMessage({ type: 'pause' } satisfies ToWorker),
      reset: () => {
        store.getState().resetWindow()
        workerRef.current?.postMessage({ type: 'reset' } satisfies ToWorker)
      },
    }),
    [store],
  )
}
