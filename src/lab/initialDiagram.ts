import type { Edge, Node } from '@xyflow/react'

// Starter topology matching the ChiffonStack teardown diagram language
// (see DESIGN.md §4 Case-Study Teardown / §7 Isotype & Logo).
// Author your layout here — drag new nodes in from the sidebar, wire them
// up, then export. Every default edge carries explicit handle ids and
// styling fields so the starter diagram renders deterministically and
// exercises the canonical shape end to end.
//
// user/router/db carry the host/queue-model chain quickstart.md's P1
// walkthrough exercises: a client pool -> a manual-mode transactional API
// (500 req/s saturation) -> a manual-mode database host, so Start is
// immediately clickable without first manually assigning roles. tool/
// fallback stay plain visual nodes (no `sim`), same as before this
// feature — their edges carry no `simConfig` either, so buildSimTopology
// excludes them from the simulated subgraph entirely.
export const initialNodes: Node[] = [
  {
    id: 'user',
    type: 'labelNode',
    position: { x: 0, y: 80 },
    data: { label: 'user', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 100 } },
    className: 'node',
  },
  {
    id: 'router',
    type: 'labelNode',
    position: { x: 220, y: 80 },
    data: {
      label: 'router',
      sim: {
        kind: 'host',
        profile: 'transactional_api',
        configMode: 'manual',
        manualBaselineLatencyMs: 10,
        manualSaturationRPS: 500,
        manualMaxRPS: 550,
      },
    },
    className: 'node node-active',
  },
  {
    id: 'tool',
    type: 'labelNode',
    position: { x: 460, y: 0 },
    data: {
      label: 'tool',
      sim: {
        kind: 'host',
        profile: 'database_server',
        configMode: 'manual',
        manualBaselineLatencyMs: 5,
        manualSaturationRPS: 1000,
        manualMaxRPS: 1100,
      },
    },
    className: 'node',
  },
  { id: 'fallback', type: 'labelNode', position: { x: 460, y: 160 }, data: { label: 'fallback' }, className: 'node node-dim' },
]

export const initialEdges: Edge[] = [
  {
    id: 'user-router',
    source: 'user',
    target: 'router',
    type: 'heat',
    data: {
      variant: 'heat-flow',
      simConfig: { trafficShareRatio: 1, averagePayloadSizeKB: 2, targetComputeWeightMultiplier: 1, pathIoLatencyMs: 0 },
    },
    sourceHandle: 'right',
    targetHandle: 'left',
  },
  {
    id: 'router-tool',
    source: 'router',
    target: 'tool',
    type: 'heat',
    data: {
      variant: 'heat-static',
      simConfig: { trafficShareRatio: 1, averagePayloadSizeKB: 1, targetComputeWeightMultiplier: 1, pathIoLatencyMs: 2 },
    },
    sourceHandle: 'right',
    targetHandle: 'left',
  },
  {
    id: 'router-fallback',
    source: 'router',
    target: 'fallback',
    type: 'heat',
    data: { variant: 'dashed' },
    sourceHandle: 'right',
    targetHandle: 'left',
  },
  {
    id: 'tool-fallback',
    source: 'tool',
    target: 'fallback',
    type: 'heat',
    data: { variant: 'default' },
    sourceHandle: 'bottom',
    targetHandle: 'top',
  },
]

