# Research: Host Autoscaling / Replica Multiplier (013)

## D1 — Sustain/cooldown as a deterministic, window-driven accumulator

**Decision**: Per host, the scaler keeps `timeAboveHighMs` and `timeBelowLowMs` accumulators advanced by `windowSizeMs` each window based on that window's per-replica saturation (crossing into the hysteresis band resets both), plus `lastActionSimTimeMs`. A scale action fires when the relevant accumulator ≥ `AUTOSCALE_SUSTAIN_MS`, bounds permit, and `simTime − lastActionSimTimeMs ≥ AUTOSCALE_COOLDOWN_MS`; firing resets both accumulators.

**Rationale**: Pure function of the window stream ⇒ FR-008 determinism and exact assertions in tests (event at window N, always). Time-based (not window-count) accumulators stay correct if `SIM_TICK_MS` is ever retuned.

**Alternatives considered**: EWMA-smoothed saturation input (HPA-style stabilization) — rejected: more internal state for no observable benefit at 200 ms windows; consecutive-window counters — rejected: silently change meaning if the tick changes.

## D2 — Boot queue: nominal vs effective replicas

**Decision**: Replica runtime state holds `nominalCount` (what the scaler manages, shown as the count) and a FIFO `booting: { readyAtSimTimeMs }[]`. `effectiveReplicas = nominalCount − booting.length`. Scale-up pushes a boot entry (`readyAt = now + AUTOSCALE_BOOT_DELAY_MS`); entries whose time has come are drained at the start of each window pass. Scale-down pops a booting entry first (cancelling unstarted capacity) before removing a serving replica, and takes effect immediately. Capacity/ρ/latency math always uses `effectiveReplicas` (floored at 1 while nominal ≥ 1... floored at `max(1, effective)` only when nominal ≥ 1 and at least one replica is serving; if all replicas of a min=1 host are booting — impossible by construction, since the first replica never boots — no special case is needed).

**Rationale**: Gives FR-006's visible lag (count rises, latency keeps climbing until `readyAt`), keeps scale-down instantaneous, and makes the booting replicas directly renderable with a pending treatment (spec assumption).

**Alternatives considered**: Ramped capacity contribution during boot — rejected: smoother but hides the teaching moment and adds a curve nobody configured.

## D3 — Per-replica math by division, not N simulated hosts

**Decision**: One simulated host per canvas host, unchanged. `flowPropagation` computes `perReplicaRPS = incomingRPS / effectiveReplicas`, runs the existing 011 `hostModel` functions on that rate (both config modes), then scales outputs back up: `forwardedRPS = perReplica.forwardedRPS × effectiveReplicas` (so the per-replica `manualMaxRPS` clamp and shedding apply per replica, FR-003), while `saturationRatio`/`latencyMs` are reported per replica. Queue drain toward a scaled consumer uses `effectiveReplicas × per-replica remaining capacity` (FR-011).

**Rationale**: Zero changes to the validated 011 formulas; O(hosts) scaler cost per window preserves SC-007; identical-replica assumption is exactly the sketch's model. min=max=1 short-circuits to the 011 code path bit-for-bit (SC-003).

**Alternatives considered**: Materializing N engine sub-hosts with real per-replica queues — rejected: O(replicas) state and metrics for identical replicas, breaks the closed telemetry shape, and contradicts FR-010b (one host).

## D4 — Scaling group visual: xyflow parent/child projection at the store boundary

**Decision**: Two new React Flow node types: `scalingGroup` (the host's canvas node becomes/borrows a box-styled container when its bounds allow scaling) and `replicaChip` (small child nodes with `parentId` + `extent: 'parent'`, non-draggable, non-connectable, non-selectable-for-config — clicks bubble to the host selection). A pure helper (`scalingGroupProjection.ts`) maps `{ nominalCount, bootingCount }` → the child-node list and vertical layout (`min(count, 4)` chips, overflow badge text, booting chips flagged pending, box height). The canvas node list is recomputed from this projection **only when a scaling event changes counts** (compare last projected counts in the store subscription), not per metrics window. Edges keep targeting the host/group node id — handles live on the group, so nothing about edge wiring changes.

**Rationale**: xyflow ^12.11 subflows give parent clipping/relative positioning for free; keeping the projection pure makes cap-4/overflow/stacking unit-testable without React (constitution VI); event-gated node-list updates honor render discipline (constitution V — per-window React state updates on node lists would violate it).

**Alternatives considered**: (a) Drawing replicas inside a single custom node's SVG — rejected: loses the "real nodes popping up" feel the product owner asked for and complicates the box/edge visual hierarchy. (b) True per-replica canvas nodes with their own edges — rejected by spec FR-010b. (c) `zustand` selector recomputing children every window — rejected: violates Principle V for zero benefit since counts change only on events.

## D5 — Serialization: bounds in, projection out

**Decision**: `minReplicas`/`maxReplicas` serialize inside the host's `data.sim` payload like every other host parameter. Projection artifacts (`scalingGroup` container geometry, `replicaChip` nodes) are excluded by the existing export whitelist in `exportDiagram.ts` — export filters node types to the serializable set; import of old JSON without bounds assigns `minReplicas: 1, maxReplicas: 1` explicitly (FR-013), keeping the no-defaults rule (the value is written at import, not defaulted in a signature).

**Rationale**: Constitution III (backward-compatible JSON with documented migration) + the state-shape constraint (UI-only artifacts whitelisted out). SC-008 asserts zero replica sub-nodes in exports.

**Alternatives considered**: Versioned schema bump — deferred to the persistence-guarantees feature; additive field with import-time fill is sufficient here.

## D6 — Formula sources

**Decision**:
- Per-replica load division & linear capacity scaling: operational analysis / utilization law — Denning & Buzen (1978), *The Operational Analysis of Queueing Network Models* (same source family as 011's capacity formula).
- Threshold scaling policy (watermarks + sustain + cooldown, step-by-one): Kubernetes Horizontal Pod Autoscaler algorithm documentation (kubernetes.io autoscaling docs) as the practitioner policy reference; optionally supplemented by AWS Auto Scaling target-tracking docs.
- Boot-delay capacity lag: cite the HPA/cloud-provider cold-start documentation note in the same descriptor.

**Rationale**: Constitution II. HPA docs are the canonical, user-recognizable citation for exactly this policy shape.

**Alternatives considered**: Control-theory literature (PID scaling) — rejected: not the policy implemented.

## D7 — Mid-run bounds edit: re-clamp on next window

**Decision**: When a topology update changes bounds, the engine re-clamps `nominalCount` into `[min, max]` at the start of the next window pass; booting entries beyond the new max are cancelled (newest first); accumulators and cooldown are preserved. No engine restart.

**Rationale**: Spec edge case; matches how every other config edit already flows through `updateTopology`.

**Alternatives considered**: Reset scaler state on any edit — rejected: makes slider experimentation punish the user with lost sustain progress.

## D8 — Scaling event history: bounded ring, telemetry-only

**Decision**: Engine keeps the last `SCALING_EVENT_HISTORY_LIMIT` (10) events per host `{ direction, newCount, simTimeMs }` and ships the full (bounded) list in each window's replica telemetry block. Inspector renders it verbatim; `reset()` clears it (FR-014).

**Rationale**: Bounded payload keeps windows structured-clone-cheap; 10 events cover any demo narrative; recomputing "recent events" UI-side from count diffs would be stateful in the wrong layer.

**Alternatives considered**: Emitting events as separate worker messages — rejected: second channel violates the windows-only contract (constitution V).

## D9 — Proportional (real-HPA) scaling, revised from a fixed ±1 step (2026-07-07)

**Decision**: When a scale-up/down trigger fires, the new replica count is computed proportionally — `desiredCount = ceil(nominalCount * perReplicaSaturation / watermark)` (the watermark just crossed: HIGH for scale-up, LOW for scale-down) — clamped to `[nominalCount+1, maxReplicas]` on the up side and `[minReplicas, nominalCount-1]` on the down side, so a trigger always changes the count by at least 1 even when the ratio rounds to no change, but can jump by more than 1 in a single action when saturation is far past the watermark (e.g. ~400% saturation from 1 replica jumps toward ~4-5 replicas in one step, clamped to `maxReplicas`). Scale-up queues one boot entry per newly-added replica (all sharing the same `readyAt`); scale-down cancels booting entries newest-first up to the removed count before removing serving replicas (generalized from the single-removal case).

**Rationale**: This is what real Kubernetes HPA actually does — `desiredReplicas = ceil(currentReplicas * currentMetricValue / desiredMetricValue)` (kubernetes.io HPA algorithm docs) is proportional to how far over/under target the metric is, not a fixed step; real HPA's own rate-limiting is a separate `behavior.scaleUp/scaleDown` policy layer (e.g. "at most 4 pods or 100% per 15s"), which this engine doesn't model separately — the existing `AUTOSCALE_COOLDOWN_MS` already bounds how often an action can fire, serving the same anti-flapping purpose without adding a second tunable. A fixed ±1 step (the original 013 decision) under-modeled a real, observable HPA behavior: a host at 400% saturation reaching its correct replica count only after several sustain+cooldown cycles instead of one proportional jump.

**Alternatives considered**: Keeping ±1 with a shorter cooldown to "simulate" faster convergence — rejected: still visibly wrong (many small hops instead of one right-sized jump) and conflates two different knobs (step size vs. rate limit) that real HPA keeps separate. Adding an explicit rate-limit policy layer (pods-per-window cap) mirroring HPA's `behavior` field exactly — rejected as unnecessary complexity for this teaching tool; the existing cooldown already prevents runaway oscillation.

## D10 — Watermarks promoted to per-host parameters (2026-07-07)

**Decision**: `highWatermark`/`lowWatermark` move from `src/engine/config.ts` internal constants (`AUTOSCALE_HIGH_WATERMARK`/`AUTOSCALE_LOW_WATERMARK`, 0.8/0.3) to required fields on `HostNodeSim`'s saturating variants — a fourth and fifth user-facing parameter alongside `minReplicas`/`maxReplicas`/`bootDelayMs`. `evaluateScaling` now takes them as explicit `ScalingDecisionInput` fields instead of importing the config constants. Import of JSON predating the fields (pre-3.3.0) fills in `LEGACY_HIGH_WATERMARK_FOR_IMPORT`/`LEGACY_HIGH_WATERMARK_FOR_IMPORT` (0.8/0.3), reproducing identical prior behavior.

**Rationale**: Same reasoning that promoted `bootDelayMs` (D-prior, constitution v3.2.0): real Kubernetes HPA does not hardcode a single global target utilization — it's a field set per-HPA-resource (`targetCPUUtilizationPercentage` in the stable API, `target.averageUtilization` in the newer `autoscaling/v2` metrics spec), so different workloads on the same cluster can run at different target utilizations. Sustain window and cooldown stay internal because they're scaler ALGORITHM policy (how the control loop behaves), not a property of the thing being scaled — the same distinction already applied to boot delay.

**Alternatives considered**: A single `targetSaturation` parameter with the hysteresis band derived internally as a fixed ratio around it (closer to real HPA's literal single-target + tolerance model) — considered but not chosen: this engine's existing two-watermark hysteresis design predates this decision and is already fully wired through the runtime/UI/tests; exposing both watermarks directly is a strict superset of flexibility (a user who wants HPA's single-target feel can just set `lowWatermark` close to `highWatermark`) without inventing a new derived-band tunable.

