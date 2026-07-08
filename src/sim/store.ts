import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import type { Edge, Node } from '@xyflow/react'
import type { EdgeMetrics, EdgeSimConfig, MetricsWindow, NodeMetrics, NodeSim, SimTopology } from '../engine/ports'
import { buildSimTopology as buildSimTopologyFromStructural, hasGeneratorRole as hasGeneratorRoleFromStructural } from '../engine/topology'
import type { RunStatus } from './workerProtocol'

// Zustand holds the simulation-run's cross-cutting state (run status, the
// latest metrics window) — the piece that would otherwise force prop
// drilling from App.tsx down through Inspector/HeatEdge (research.md D4).
// Node/edge *structure* stays on React Flow's own controlled state
// (useNodesState/useEdgesState in App.tsx, unchanged from before this
// feature) — this skeleton scopes the pivot's store to the new simulation
// concern rather than rewriting the already-tested diagram-editing stack.
// Created with `createStore` (vanilla) and wrapped by a `useStore` hook so
// the store itself stays unit-testable without mounting React.
export interface SimStoreState {
  runStatus: RunStatus
  statusMessage: string | undefined
  latestWindow: MetricsWindow | undefined
  setRunStatus(status: RunStatus, message: string | undefined): void
  setWindow(window: MetricsWindow): void
  resetWindow(): void
}

export function createSimStore() {
  return createStore<SimStoreState>((set) => ({
    runStatus: 'idle',
    statusMessage: undefined,
    latestWindow: undefined,
    setRunStatus: (status, message) => set({ runStatus: status, statusMessage: message }),
    setWindow: (window) => set({ latestWindow: window }),
    resetWindow: () => set({ latestWindow: undefined }),
  }))
}

export type SimStore = ReturnType<typeof createSimStore>

export function useSimStore<T>(store: SimStore, selector: (state: SimStoreState) => T): T {
  return useStore(store, selector)
}

function nodeSim(node: Node): NodeSim | undefined {
  const sim = (node.data as { sim?: NodeSim } | undefined)?.sim
  return sim
}

function edgeSimConfig(edge: Edge): EdgeSimConfig | undefined {
  return (edge.data as { simConfig?: EdgeSimConfig } | undefined)?.simConfig
}

// xyflow-facing adapter over the engine's pure, structural buildSimTopology
// (assessment.md A2): unwraps React Flow's `data.sim`/`data.simConfig`
// into the structural shape the engine itself accepts, so the engine has
// no dependency on `@xyflow/react` types. This is the only place in the
// app that does that unwrapping.
export function buildSimTopology(nodes: Node[], edges: Edge[]): SimTopology {
  return buildSimTopologyFromStructural(
    nodes.map((node) => ({ id: node.id, sim: nodeSim(node) })),
    edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, config: edgeSimConfig(edge) })),
  )
}

// A simulation needs at least one traffic source to be worth running —
// exactly one host profile emits traffic without any inbound edges: the
// client pool (data-model.md).
export function hasGeneratorRole(nodes: Node[]): boolean {
  return hasGeneratorRoleFromStructural(nodes.map((node) => ({ id: node.id, sim: nodeSim(node) })))
}

export function selectNodeMetrics(window: MetricsWindow | undefined, nodeId: string): NodeMetrics | undefined {
  return window?.nodes[nodeId]
}

export function selectEdgeMetrics(window: MetricsWindow | undefined, edgeId: string): EdgeMetrics | undefined {
  return window?.edges[edgeId]
}
