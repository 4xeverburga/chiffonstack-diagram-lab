import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import type { Edge, Node } from '@xyflow/react'
import type { EdgeMetrics, MetricsWindow, NodeMetrics, SimRole, SimTopology } from '../engine/ports'
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

function nodeSimRole(node: Node): SimRole | undefined {
  const sim = (node.data as { sim?: SimRole } | undefined)?.sim
  return sim
}

// Builds the engine's SimTopology view from React Flow's nodes/edges
// (data-model.md): only nodes carrying a `sim` role participate, and edges
// are reduced to their bare source/target ids.
export function buildSimTopology(nodes: Node[], edges: Edge[]): SimTopology {
  const simNodeIds = new Set<string>()
  const topologyNodes = nodes.flatMap((node) => {
    const sim = nodeSimRole(node)
    if (!sim) return []
    simNodeIds.add(node.id)
    return [{ id: node.id, sim }]
  })
  const topologyEdges = edges
    .filter((edge) => simNodeIds.has(edge.source) && simNodeIds.has(edge.target))
    .map((edge) => ({ id: edge.id, source: edge.source, target: edge.target }))
  return { nodes: topologyNodes, edges: topologyEdges }
}

export function hasGeneratorRole(nodes: Node[]): boolean {
  return nodes.some((node) => nodeSimRole(node)?.role === 'generator')
}

export function selectNodeMetrics(window: MetricsWindow | undefined, nodeId: string): NodeMetrics | undefined {
  return window?.nodes[nodeId]
}

export function selectEdgeMetrics(window: MetricsWindow | undefined, edgeId: string): EdgeMetrics | undefined {
  return window?.edges[edgeId]
}
