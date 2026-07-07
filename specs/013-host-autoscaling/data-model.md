# Data Model: Host Autoscaling / Replica Multiplier (013)

Delta on 011's shapes ([011 data-model](../011-host-queue-model/data-model.md)). Config in through `TopologyPort`, telemetry out through `MetricsSinkPort`; the scaling-group visual is a `src/lab` projection and appears in **no** engine or serialized shape.

## Configuration (in)

### HostNodeSim (extended — saturating variants only)

```ts
// manual and calculated variants (transactional_api | worker_consumer | database_server) gain:
{
  minReplicas: number   // integer ≥ 1
  maxReplicas: number   // integer ≥ minReplicas
  bootDelayMs: number    // ≥ 0 — simulated ms a new replica takes before serving traffic
  highWatermark: number  // ≥ 0 — per-replica saturation ratio that triggers scale-up accumulation
  lowWatermark: number   // ≥ 0, < highWatermark — triggers scale-down accumulation
}
// client_pool and external_api variants are UNCHANGED (no replica fields).
```

Validation: integers ≥ 1 for min/max, `minReplicas ≤ maxReplicas` (enforced in Inspector fields and guarded in the engine); `bootDelayMs ≥ 0`; `lowWatermark < highWatermark` (both ≥ 0). Import of pre-013 JSON writes `minReplicas: 1, maxReplicas: 1, bootDelayMs: LEGACY_BOOT_DELAY_MS_FOR_IMPORT, highWatermark: LEGACY_HIGH_WATERMARK_FOR_IMPORT, lowWatermark: LEGACY_LOW_WATERMARK_FOR_IMPORT` explicitly (research D5); import of pre-3.2.0/pre-3.3.0 JSON (missing only the newer fields) fills in just the missing fields the same way.

**Closed parameter set after this feature (constitution v3.3.0)**: 011's FR-020 list **plus** `minReplicas`, `maxReplicas`, `bootDelayMs`, `highWatermark`, `lowWatermark`. Sustain window, cooldown, visible-replica cap, and event-history limit are internal tunables in `src/engine/config.ts` — boot delay and the watermarks are NOT among them (promoted to user-facing capability parameters: boot delay varies by real infrastructure, and real Kubernetes HPA likewise sets its target utilization per resource rather than globally).


## Engine runtime state (per scaled host, cross-window)

```ts
interface ReplicaRuntime {
  nominalCount: number                    // scaler-managed; init = minReplicas; ∈ [min, max]
  booting: { readyAtSimTimeMs: number }[] // FIFO; drained at window start (research D2)
  timeAboveHighMs: number                 // sustain accumulators (research D1)
  timeBelowLowMs: number
  lastActionSimTimeMs: number | undefined // cooldown anchor; undefined until first action
  events: ScalingEvent[]                  // bounded ring, SCALING_EVENT_HISTORY_LIMIT (research D8)
}
```

`effectiveReplicas = nominalCount − booting.length` (≥ 1 by construction: the initial replica never boots). `reset()` restores `nominalCount = minReplicas`, clears booting/accumulators/events (FR-014). Bounds edits re-clamp on the next window (research D7).

## Telemetry (out, per metrics window)

### HostNodeMetrics (extended)

```ts
interface ScalingEvent {
  direction: 'up' | 'down'
  newCount: number
  simTimeMs: number
}

interface HostReplicaTelemetry {
  nominalCount: number        // what the badge shows
  bootingCount: number        // renders as pending chips
  effectiveCount: number      // serving capacity divisor
  perReplicaSaturation: number
  events: ScalingEvent[]      // bounded, most recent last
}

interface HostNodeMetrics {
  // ... 011 fields unchanged; saturationRatio/latencyMs are PER REPLICA on scaled hosts
  replicas?: HostReplicaTelemetry   // present only on saturating profiles
}
```

Semantics (research D3): `perReplicaRPS = incomingRPS / effectiveCount`; 011 host math runs on `perReplicaRPS`; `forwardedRPS`/`shedRPS` scale back by `effectiveCount` (per-replica `manualMaxRPS` clamp ⇒ total cap = `effectiveCount × manualMaxRPS`). Queue drain toward the host uses `effectiveCount ×` per-replica remaining capacity (FR-011). With `minReplicas = maxReplicas = 1` every value equals the 011 output exactly (SC-003).

## Scaler decision (pure, per window — research D1/D9)

```text
saturation ≥ HIGH for ≥ SUSTAIN, count < max, cooldown elapsed  → desiredCount = ceil(count * saturation / HIGH), clamped to [count+1, max] (one boot entry queued per added replica)
saturation ≤ LOW  for ≥ SUSTAIN, count > min, cooldown elapsed  → desiredCount = ceil(count * saturation / LOW), clamped to [min, count-1] (immediate; cancels booting entries newest-first up to the removed count)
otherwise                                                        → hold (band resets accumulators)
```

Proportional like real Kubernetes HPA (research D9) — a single action can change the count by more than one replica when saturation is far past the triggering watermark, not just ±1.

Deterministic: pure function of `(ReplicaRuntime, windowSaturation, simTime, config)` → `(ReplicaRuntime', event?)`.

## Scaling-group visual projection (src/lab only — never serialized)

```ts
interface ScalingGroupProjection {
  visibleChips: { index: number; booting: boolean }[]  // length = min(nominalCount, VISIBLE_REPLICA_CAP=4)
  overflowCount: number                                // nominalCount − visible, ≥ 0 → "+N" badge
  groupHeightPx: number                                // vertical stack layout
  pulse: 'up' | 'down' | null                          // transient treatment on a new event
}
```

Rules: computed by a pure helper from `HostReplicaTelemetry`; canvas node list updates only when counts change (event-gated, research D4); chips are non-draggable/non-connectable, clicks select the host; edges attach to the group node id; export whitelist excludes group/chip node types (SC-008); a host with `min = max = 1` renders as a plain host node (no box).

## State transitions

- `nominalCount`: min ⇄ max in ±1 steps, gated by sustain + cooldown; re-clamped on bounds edit.
- Booting entry: created on scale-up → drained (serving) when `simTime ≥ readyAtSimTimeMs` → or cancelled by scale-down/bounds re-clamp.
- Events ring: append per action, trimmed to limit, cleared on reset.
