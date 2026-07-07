# Contract: Engine Ports (delta for 013)

Delta on [011's contract](../../011-host-queue-model/contracts/engine-ports.md). Port surface (TopologyPort / TrafficSourcePort / MetricsSinkPort / Simulation) unchanged; payload deltas only.

## Payload changes

| Type | 011 | 013 |
|---|---|---|
| `HostNodeSim` (saturating variants) | manual/calculated fields | + `minReplicas: number`, `maxReplicas: number` (integers, 1 ≤ min ≤ max) |
| `HostNodeMetrics` | 011 fields | + `replicas?: HostReplicaTelemetry` (saturating profiles only); `saturationRatio`/`latencyMs` become per-replica values on scaled hosts |

## Behavioral guarantees

1. **Regression**: `minReplicas = maxReplicas = 1` produces metrics bit-identical to 011 for any input stream (SC-003).
2. **Determinism**: identical topology + seed + tick sequence ⇒ identical scaling event sequence and telemetry (FR-008); the scaler is a pure per-window function of runtime state, window saturation, and sim time.
3. **Boot lag**: a scale-up increments `nominalCount` immediately but `effectiveCount` (the capacity divisor) only after `AUTOSCALE_BOOT_DELAY_MS` of simulated time; scale-down affects capacity in the next window.
4. **Rate limits**: at most one scaling action per host per `AUTOSCALE_COOLDOWN_MS`; actions require the watermark condition to hold for `AUTOSCALE_SUSTAIN_MS` of simulated time; the band between watermarks never scales (hysteresis).
5. **Bounds**: `nominalCount ∈ [minReplicas, maxReplicas]` always, including after mid-run bounds edits (re-clamped next window, booting entries beyond the new max cancelled).
6. **Composition with 011 semantics**: per-replica `manualMaxRPS` clamping/shedding (total cap = effectiveCount × cap); queue drain toward a scaled consumer = effectiveCount × per-replica remaining capacity.
7. **Bounded payloads**: `events` carries at most `SCALING_EVENT_HISTORY_LIMIT` entries; no scaling information leaves the engine outside metrics windows (no extra worker messages).
8. **Reset**: `reset()` restores `nominalCount = minReplicas`, clears booting entries, sustain accumulators, cooldown anchor, and event history.
9. **Traceability**: replica-division and scaling-policy formula descriptors (with sources) accompany scaled hosts' metrics; `validateFormulaDescriptorsHaveSources` still gates emission.

## UI-side contract (projection, not a port)

The scaling-group visual consumes `HostReplicaTelemetry` read-only. Replica chip / group container node types never appear in `SimTopology`, never receive edges, and are excluded from exported JSON (SC-008). The engine has no knowledge of the projection.
