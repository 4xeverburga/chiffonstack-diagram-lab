import type { Edge, Node } from '@xyflow/react'

// Starter topology: a small e-commerce-style checkout system, chosen to
// exercise every host/queue-model concept at once so Start is immediately
// clickable without first authoring a diagram from scratch:
//   web-client (client pool)
//     -> api-gateway (manual-mode transactional API), which SEQUENTIALLY
//        calls two downstream services on every request — both edges
//        carry trafficShareRatio 1.0, since shares are independent
//        per-edge multipliers, not normalized to sum to 1 (a fan-out
//        can be a SPLIT, a BROADCAST, or a mix of both at once):
//          -> orders-queue (zero-config queue, share 1.0 — always writes
//               the order) -> orders-worker (calculated-mode worker)
//                    -> postgres-db (manual-mode database, also read
//                         directly by api-gateway, share 1.0 — a
//                         converging host fed by two edges, demonstrating
//                         the traffic-weighted inbound compute-weight
//                         average)
//          -> payments-api (external_api — bottomless third-party call),
//               a CONDITIONAL branch: only ~25% of requests are card
//               payments that need it (share 0.25)
//          -> static-assets (a plain, non-simulated node — proves plain
//               nodes/edges keep coexisting with simulated ones)
// Author your layout here — drag new nodes in from the sidebar, wire them
// up, then export. Every default edge carries explicit handle ids and
// styling fields so the starter diagram renders deterministically and
// exercises the canonical shape end to end.
export const initialNodes: Node[] = [
  {
    id: 'web-client',
    type: 'labelNode',
    position: { x: 0, y: 200 },
    data: { label: 'web client', sim: { kind: 'host', profile: 'client_pool', requestRatePerSec: 150 } },
    className: 'node',
  },
  {
    id: 'api-gateway',
    type: 'labelNode',
    position: { x: 260, y: 200 },
    data: {
      label: 'api gateway',
      sim: {
        kind: 'host',
        profile: 'transactional_api',
        configMode: 'manual',
        manualBaselineLatencyMs: 8,
        manualSaturationRPS: 600,
        manualMaxRPS: 650,
        minReplicas: 1,
        maxReplicas: 4,
        bootDelayMs: 8000,
      },
    },
    className: 'node node-active',
  },
  {
    id: 'orders-queue',
    type: 'labelNode',
    position: { x: 560, y: 40 },
    data: { label: 'orders queue', sim: { kind: 'queue' } },
    className: 'node',
  },
  {
    id: 'orders-worker',
    type: 'labelNode',
    position: { x: 820, y: 40 },
    data: {
      label: 'orders worker',
      sim: {
        kind: 'host',
        profile: 'worker_consumer',
        configMode: 'calculated',
        cpuProcessingTimeMs: 20,
        maxWorkerThreads: 12,
        minReplicas: 1,
        maxReplicas: 4,
        bootDelayMs: 8000,
      },
    },
    className: 'node',
  },
  {
    id: 'postgres-db',
    type: 'labelNode',
    position: { x: 1080, y: 160 },
    data: {
      label: 'postgres db',
      sim: {
        kind: 'host',
        profile: 'database_server',
        configMode: 'manual',
        manualBaselineLatencyMs: 3,
        manualSaturationRPS: 2000,
        manualMaxRPS: 2200,
        minReplicas: 1,
        maxReplicas: 1,
        bootDelayMs: 8000,
      },
    },
    className: 'node',
  },
  {
    id: 'payments-api',
    type: 'labelNode',
    position: { x: 560, y: 320 },
    data: { label: 'payments api', sim: { kind: 'host', profile: 'external_api', manualBaselineLatencyMs: 120 } },
    className: 'node',
  },
  {
    id: 'static-assets',
    type: 'labelNode',
    position: { x: 260, y: 380 },
    data: { label: 'static assets' },
    className: 'node node-dim',
  },
]

export const initialEdges: Edge[] = [
  {
    id: 'web-client-api-gateway',
    source: 'web-client',
    target: 'api-gateway',
    type: 'heat',
    data: {
      variant: 'heat-flow',
      simConfig: { trafficShareRatio: 1, averagePayloadSizeKB: 2, targetComputeWeightMultiplier: 1, pathIoLatencyMs: 0 },
    },
    sourceHandle: 'right',
    targetHandle: 'left',
  },
  {
    id: 'api-gateway-orders-queue',
    source: 'api-gateway',
    target: 'orders-queue',
    type: 'heat',
    data: {
      variant: 'heat-flow',
      // Every request writes an order — always fires (share 1.0), same as
      // the direct postgres-db read below: a host's outgoing shares are
      // independent multipliers, not normalized to sum to 1, so two edges
      // can each carry 100% of the source's output (sequential/broadcast
      // calls to multiple downstream services per request).
      simConfig: { trafficShareRatio: 1, averagePayloadSizeKB: 3, targetComputeWeightMultiplier: 1, pathIoLatencyMs: 1 },
    },
    sourceHandle: 'top',
    targetHandle: 'left',
  },
  {
    id: 'api-gateway-payments-api',
    source: 'api-gateway',
    target: 'payments-api',
    type: 'heat',
    data: {
      variant: 'heat-static',
      // A conditional branch: only ~25% of requests are card payments that
      // need this call.
      simConfig: { trafficShareRatio: 0.25, averagePayloadSizeKB: 1, targetComputeWeightMultiplier: 1, pathIoLatencyMs: 0 },
    },
    sourceHandle: 'bottom',
    targetHandle: 'left',
  },
  {
    id: 'api-gateway-postgres-db',
    source: 'api-gateway',
    target: 'postgres-db',
    type: 'heat',
    data: {
      variant: 'heat-static',
      // Every request also does a synchronous session/user lookup — always
      // fires (share 1.0), sequential with the orders-queue write above.
      simConfig: { trafficShareRatio: 1, averagePayloadSizeKB: 1, targetComputeWeightMultiplier: 1, pathIoLatencyMs: 0 },
    },
    sourceHandle: 'right',
    targetHandle: 'bottom',
  },
  {
    id: 'orders-queue-orders-worker',
    source: 'orders-queue',
    target: 'orders-worker',
    type: 'heat',
    data: {
      variant: 'heat-flow',
      simConfig: { trafficShareRatio: 1, averagePayloadSizeKB: 3, targetComputeWeightMultiplier: 1, pathIoLatencyMs: 2 },
    },
    sourceHandle: 'right',
    targetHandle: 'left',
  },
  {
    id: 'orders-worker-postgres-db',
    source: 'orders-worker',
    target: 'postgres-db',
    type: 'heat',
    data: {
      variant: 'heat-flow',
      simConfig: { trafficShareRatio: 1, averagePayloadSizeKB: 1, targetComputeWeightMultiplier: 2, pathIoLatencyMs: 1 },
    },
    sourceHandle: 'right',
    targetHandle: 'top',
  },
  {
    id: 'api-gateway-static-assets',
    source: 'api-gateway',
    target: 'static-assets',
    type: 'heat',
    data: { variant: 'dashed' },
    sourceHandle: 'bottom',
    targetHandle: 'top',
  },
]


