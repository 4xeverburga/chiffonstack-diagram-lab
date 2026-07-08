# Data Model: Overload Collapse Mode for Host Nodes (012)

Delta on 011's shapes ([011 data-model](../011-host-queue-model/data-model.md)) as extended by 013 ([013 data-model](../013-host-autoscaling/data-model.md)). Config in through `TopologyPort`, telemetry out through `MetricsSinkPort` — no new engine state, no new ports, no new cross-window carried maps (research.md D4).

## Configuration (in)

### HostNodeSim (extended — saturating variants only)

```ts
// manual AND calculated variants (transactional_api | worker_consumer | database_server) gain:
{
  overloadBehavior: 'clamp' | 'collapse'
}
// client_pool and external_api variants are UNCHANGED (no overloadBehavior field — FR-006).
```

This is the **only** new user-facing field (FR-001). `minReplicas`/`maxReplicas`/`bootDelayMs`/`highWatermark`/`lowWatermark` (013) are unaffected.

**Closed parameter set after this feature (constitution v3.4.0)**: 013's closed set (011's FR-020 list plus the five 013 replica-scaling fields) **plus** `overloadBehavior`. The decay steepness (`HOST_COLLAPSE_DECAY_KAPPA`) and the collapsed-status goodput ratio (`HOST_COLLAPSE_STATUS_RATIO`) are internal tunables in `src/engine/config.ts` — never surfaced as user inputs (FR-004).

**Validation**: `overloadBehavior` is one of the two literal strings; no cross-field validation needed (unlike `minReplicas ≤ maxReplicas` etc.) since it doesn't interact numerically with any other field. Import of pre-012 JSON (missing the field entirely) writes `overloadBehavior: LEGACY_OVERLOAD_BEHAVIOR_FOR_IMPORT` (`'clamp'`) explicitly at import time (FR-005/SC-005) — never guessed in a function signature default (CLAUDE.md). Newly-assigned compute profiles (Inspector "assign role" action) and the starter demo topology default to `'collapse'` (FR-005, research.md D6).

## Engine computation (per window, no new cross-window state)

### The knee (research.md D1)

```ts
// Manual mode:
kneeRPS = max(0, sim.manualMaxRPS)

// Calculated mode (algebraically the incomingRPS at which the existing
// unclamped rho would read exactly 1.0):
kneeRPS = threads > 0 && cpuTimeSec > 0 && weight > 0
  ? threads / (weight * cpuTimeSec)
  : 0
```

### Collapse curve (research.md D2/D3) — shared helper, both modes

```ts
function collapseForwardedRPS(incomingRPS: number, kneeRPS: number): number {
  if (kneeRPS <= HOST_ZERO_CAPACITY_EPSILON) return 0        // zero-capacity host forwards zero, always
  if (incomingRPS <= kneeRPS) return incomingRPS              // at/below the knee: identical to clamp
  const overloadRatio = incomingRPS / kneeRPS                 // > 1, past the knee
  return kneeRPS / (1 + HOST_COLLAPSE_DECAY_KAPPA * (overloadRatio - 1) ** 2)
}
```

Properties (FR-003, edge cases): continuous at the knee (`= kneeRPS` exactly at `overloadRatio = 1`); strictly monotonically decreasing for `overloadRatio > 1`; `→ 0` as `overloadRatio → ∞`; always finite, always `> 0` for finite input; pure function of `incomingRPS`/`kneeRPS` only — no state (FR-010, SC-004 stateless/symmetric sweep).

### `forwardedRPS`/`shedRPS` (both modes)

```ts
forwardedRPS = sim.overloadBehavior === 'collapse'
  ? collapseForwardedRPS(incomingRPS, kneeRPS)
  : /* clamp: unchanged 011/013 behavior per mode */
      configMode === 'manual' ? min(incomingRPS, kneeRPS) : incomingRPS
shedRPS = max(0, incomingRPS - forwardedRPS)   // FR-008, both modes
```

`clamp` + calculated stays exactly `forwardedRPS = incomingRPS`, `shedRPS = 0` always (011/SC-003 regression guarantee, unchanged). `collapse` + calculated is new: it can now shed past ρ=1, unlike 011/013's calculated mode which never sheds.

Latency (`hockeyStickLatencyMs`) is **untouched** — same base latency, same ρ-clamped hockey-stick curve in both modes (FR-013: latency must never improve as goodput collapses; leaving it alone trivially satisfies this and SC-002's latency-equality requirement below the knee).

### Status (research.md D5)

```ts
interface HostNodeMetrics {
  // ... 011/013 fields unchanged
  status: 'healthy' | 'saturated' | 'overloaded' | 'collapsed'   // + 'collapsed'
}
```

```ts
// Checked FIRST, before the existing overloaded/saturated/healthy ladder:
if (
  sim.overloadBehavior === 'collapse' &&
  incomingRPS > kneeRPS &&
  forwardedRPS < kneeRPS * HOST_COLLAPSE_STATUS_RATIO   // new internal tunable, 0.5
) return 'collapsed'
// ...existing ladder unchanged
```

### Queue backpressure — unchanged (research.md D4)

`hostAcceptCapacityRPS` in `flowPropagation.ts` is **not modified**: `manualMaxRPS × effectiveCount` (manual) / `Infinity` (calculated, external_api, client_pool) regardless of `overloadBehavior`. Since the knee is now the same value (`manualMaxRPS`) in both modes, there is nothing mode-dependent to compute here — no new propagation rule (FR-009).

## Telemetry (out, per metrics window) — no new fields beyond `status`

`HostNodeMetrics.forwardedRPS`/`.shedRPS`/`.saturationRatio`/`.latencyMs`/`.replicas` are structurally unchanged; only their *values* differ in collapse mode past the knee, and only `status` gains the new literal. `NodeMetrics.formulaDescriptors` gains one additional entry (collapse formula) only when `sim.overloadBehavior === 'collapse'` (research.md D7).

## Canvas treatment (src/lab, never serialized)

- `hostStatusTreatment.ts`'s `APPLIED_STATUSES` gains `'collapsed'` — same idempotent-className derivation already used for `saturated`/`overloaded` (no new pattern).
- `App.css` gains a third `.sim-status-collapsed` treatment (border/glow), visually distinct from `saturated`/`overloaded` (same mechanism, new keyframe/color — exact look is an implementation-phase decision, not constrained by this plan beyond "distinct").
- `NodeInfoButton.tsx` needs no change — it already renders `host.status` verbatim as text, so `'collapsed'` displays automatically.

## Inspector UI (src/lab)

- `hostConfigFields.tsx`: new `OverloadBehaviorField` chip control (`clamp`/`collapse`), rendered once for both config modes, in the branch already gated to compute profiles only (`client_pool`/`external_api` return earlier in the same function — FR-006 holds with zero extra conditionals). `handleModeChange` carries `overloadBehavior` over unchanged on a mode switch, same pattern as the 013 replica fields.
- `Inspector.tsx`'s `defaultSimForChoice`: `overloadBehavior: 'collapse'` on newly-assigned compute-profile hosts (FR-005).
- `initialDiagram.ts`: starter-topology hosts get `overloadBehavior: 'collapse'` (fresh, code-authored content — not an imported legacy diagram).

## Serialization / migration (constitution III)

- `exportDiagram.ts`'s `plainNodeSim`: reads `value.overloadBehavior`, validates it's `'clamp' | 'collapse'`, else fills `LEGACY_OVERLOAD_BEHAVIOR_FOR_IMPORT` (`'clamp'`, new `config.ts` constant) — same "absence, not just an invalid value, triggers the legacy fill" pattern already used for `bootDelayMs`/watermarks (FR-005/SC-005).
- New/edited-in-app hosts always carry an explicit value (no silent default in a function signature — CLAUDE.md).

## State transitions

`overloadBehavior` is a static per-host config value, edited only through the Inspector like every other host field; it has no runtime state machine of its own (no hysteresis — FR-010). Switching it mid-run takes effect on the next metrics window like any other config edit (existing `updateTopology` flow, no special-casing needed — edge case "mode switch mid-run").
