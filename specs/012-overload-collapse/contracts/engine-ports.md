# Contract: Engine Ports (delta for 012)

Delta on [013's contract](../../013-host-autoscaling/contracts/engine-ports.md) (which itself deltas [011's](../../011-host-queue-model/contracts/engine-ports.md)). Port surface (`TopologyPort` / `TrafficSourcePort` / `MetricsSinkPort` / `Simulation`) unchanged; payload deltas only. No new engine state, no new cross-window carried maps, no new `FlowPropagationInput`/`Output` fields (research.md D4).

## Payload changes

| Type | 013 | 012 |
|---|---|---|
| `HostNodeSim` (manual AND calculated saturating variants) | 013 fields (replica bounds/boot delay/watermarks) | + `overloadBehavior: 'clamp' \| 'collapse'` — the only new field |
| `HostNodeMetrics.status` | `'healthy' \| 'saturated' \| 'overloaded'` | + `'collapsed'` |
| `HostNodeMetrics.forwardedRPS`/`.shedRPS` | as 011/013 | unchanged shape; values differ past the knee when `overloadBehavior === 'collapse'` |
| `NodeMetrics.formulaDescriptors` (host) | as 013 | + one collapse-formula descriptor, only present when `overloadBehavior === 'collapse'` |

`client_pool` and `external_api` variants of `HostNodeSim` are completely unchanged (FR-006 — no field, no control, no formula).

## Behavioral guarantees

1. **Regression (SC-003)**: `overloadBehavior: 'clamp'` produces metrics bit-identical to pre-012 (011/013) behavior for any input stream, in both manual and calculated config modes — including the formula descriptor set (no collapse descriptor appears for clamp-mode hosts).
2. **Knee continuity (FR-003, edge case)**: for `incomingRPS ≤ kneeRPS` (manual: `manualMaxRPS`; calculated: the ρ=1 point), `forwardedRPS = incomingRPS` in **both** modes — clamp and collapse report identical `forwardedRPS`/`shedRPS`/`saturationRatio`/`latencyMs` at and below the knee (SC-002), with exact (not approximate) equality since both branches evaluate the same expression there.
3. **Retrograde past the knee (FR-003)**: for `incomingRPS > kneeRPS` in `collapse` mode, `forwardedRPS` is a smooth, strictly monotonically decreasing, finite, `≥ 0` function of `incomingRPS` (research.md D2) — no discontinuity anywhere in the sweep (SC-001).
4. **Statelessness (FR-010, SC-004)**: `forwardedRPS`/`shedRPS`/`status` in collapse mode are pure functions of the current window's `incomingRPS` and the host's static config — no hysteresis, no carried state; sweeping load up then back down to the same offered value reproduces the same goodput exactly.
5. **Shed accounting (FR-008)**: `shedRPS = max(0, incomingRPS − forwardedRPS)` holds in every mode/configMode combination, including calculated+collapse (newly nonzero past the knee — a behavior 011/013's calculated mode never had).
6. **Latency untouched (FR-013)**: `latencyMs` computation is identical in both `overloadBehavior` values — collapse never improves latency as goodput falls.
7. **Zero-capacity (edge case)**: a collapse-mode host with `kneeRPS ≤ 0` forwards `0` at any offered load — no NaN/Infinity.
8. **Status (FR-007)**: `'collapsed'` is reported only for collapse-mode hosts past their knee with `forwardedRPS` below `HOST_COLLAPSE_STATUS_RATIO × kneeRPS`; checked before the existing `overloaded`/`saturated`/`healthy` ladder.
9. **No new propagation rule (FR-009)**: `hostAcceptCapacityRPS` (queue backpressure sizing) is byte-identical for both modes; downstream edge/queue propagation of a collapsed host's low `forwardedRPS` rides the existing, unmodified `edgeOutputRPS`/`computeQueueMetrics` mechanism.
10. **Traceability (constitution II, FR-011)**: the collapse formula descriptor carries ≥ 1 source citation and is present in a collapse-mode host's `formulaDescriptors` whenever selected; `validateFormulaDescriptorsHaveSources` still gates emission.
11. **Serialization (constitution III, FR-005)**: `overloadBehavior` round-trips through export/import; its absence in imported JSON resolves to `'clamp'` (`LEGACY_OVERLOAD_BEHAVIOR_FOR_IMPORT`), never guessed at a call site without the constant.

## UI-side contract (not a port)

`hostStatusTreatment.ts`'s status→className mapping and the Inspector's collapse formula panel consume `HostNodeMetrics`/`NodeMetrics.formulaDescriptors` read-only; the engine has no knowledge of canvas treatment.
