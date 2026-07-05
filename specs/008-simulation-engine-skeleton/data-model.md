# Data Model: Simulation Engine Walking Skeleton

Entity shapes for feature 008. Engine-side types live in `src/engine/`
(pure TS); UI-side types extend React Flow node/edge `data`. Serialization
rules follow the whitelist pattern in `exportDiagram.ts`.

## SimRole (engine + serialized)

Discriminated union on `role`:

```ts
type SimRole =
  | { role: 'generator'; ratePerSec: number }          // Poisson mean arrival rate, ≥ 0
  | { role: 'processor'; serviceRatePerSec: number }   // fixed rate, > 0; unbounded FIFO queue
  | { role: 'sink' }                                   // absorbs everything
```

- Validation: `ratePerSec ≥ 0`; `serviceRatePerSec > 0`; rejected at the
  Inspector boundary with inline feedback (never silently clamped).
- A node with no `sim` payload is a plain diagram node (legacy diagrams
  import as all-plain — FR-009).
- The `processor` role is presented in UI copy as
  "Placeholder (fixed rate)" per FR-002 / Principle I.

## Node `data` extension (UI, serialized subset)

```ts
data: {
  label: string                 // existing
  image?: string                // existing (base64 data URI)
  sim?: SimRole                 // NEW — serialized to topology JSON
  simMetrics?: NodeMetrics      // NEW — transient, NEVER serialized
}
```

## Edge `data` extension (UI, transient only)

```ts
data: {
  …existing (variant, thickness, direction)…
  simMetrics?: EdgeMetrics      // transient, NEVER serialized
}
```

## Topology (engine input, via TopologyPort)

The engine's own view — derived from store nodes/edges by the worker
adapter; contains no positions, labels, or visuals:

```ts
interface SimTopology {
  nodes: { id: string; sim: SimRole }[]   // only nodes with a role
  edges: { id: string; source: string; target: string }[]
}
```

- Fan-out rule (skeleton): a node's output is split equally across its
  outgoing edges. Fan-in sums.
- Cycle handling: cycles are detected at `start` and rejected with a
  `status: 'error'` message naming the cycle (spec edge case; real
  cyclic semantics deferred).

## MetricsWindow (worker → UI, one per 200 ms)

```ts
interface MetricsWindow {
  windowEndSimTimeMs: number
  nodes: Record<string, NodeMetrics>
  edges: Record<string, EdgeMetrics>
}

interface NodeMetrics {
  throughputPerSec: number   // departures during window, scaled to per-sec
  queueDepth: number         // instantaneous at window end
}

interface EdgeMetrics {
  throughputPerSec: number   // traffic crossing edge during window, per-sec
}
```

## RunStatus (store + worker protocol)

```
idle ──start──▶ running ──pause──▶ paused ──start──▶ running
  ▲                │                  │
  └────reset───────┴──────reset───────┘
running/paused ──topology-edit-while-running──▶ (auto-pause + notice)
start with no generator, or cycle detected ──▶ error (message shown, stays idle)
```

- `reset` zeroes all `simMetrics` and virtual time.
- Deleting nodes/edges while running triggers the auto-pause path
  (spec edge case: never crash, never silently ignore).

## AnimationParams (engine, consumed by HeatEdge adapter)

```ts
interface AnimationParams {
  durationSec: number   // clamped [0.4, 6.0]
  dashDensity: number   // clamped [0, 1], mapped to dasharray presets
}
```

Produced by `mapThroughputToAnimation(throughputPerSec, mappingConfig)`;
`mappingConfig` (V_min, V_max, k, x₀ on log₁₀ scale) is a module constant —
explicit argument per the no-default-parameters rule.

## Serialization rules (FR-009)

| Field | In topology JSON? |
|---|---|
| node `label`, `image`, position, size, kind | yes (existing) |
| node `data.sim` | **yes** |
| node `data.simMetrics`, edge `data.simMetrics` | **no** (transient) |
| edge variant/thickness/direction | yes (existing) |
| run status, virtual time | no |

Round-trip invariant: parse(serialize(topology)) is deep-equal on the
serialized subset; all transient fields reset to initial values.
