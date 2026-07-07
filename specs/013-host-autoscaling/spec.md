# Feature Specification: Host Autoscaling / Replica Multiplier

**Feature Branch**: `013-host-autoscaling`

**Created**: 2026-07-06

**Status**: Draft

**Input**: User description: "Non-source hosts gain horizontal scaling: minReplicas/maxReplicas bound an auto-scaler that adds a replica under sustained high saturation and removes one under sustained low saturation, with boot delay before new capacity arrives. Exactly two new user-facing parameters; thresholds/cooldowns/boot time are internal tunables. Requires a constitution amendment to the closed parameter set."

## Overview

Deferred from the original SUGAR sketch and spec 011's out-of-scope list. Saturating host profiles (transactional API, worker/consumer, database) gain horizontal scaling: incoming load divides across replicas, each replica runs the existing 011 saturation/latency math, and an auto-scaler adds or removes one replica at a time in response to *sustained* saturation crossing high/low watermarks — with a realistic boot delay before a new replica contributes capacity, so users see latency spike before relief arrives.

Exactly **two** new user-facing parameters: `minReplicas` and `maxReplicas`. Scaling thresholds, the sustain window, cooldown between actions, and boot delay are internal engine tunables. `currentReplicaCount` is telemetry, not an input. Admitting the two fields requires a constitution amendment to Principle I (MINOR bump), in scope for this feature.

This feature is independent of 012-overload-collapse; if both land, overload behavior applies per replica (integration assumption, no conflict by design).

## Clarifications

### Session 2026-07-06

- Directive (product owner): scaling must be **visually explicit on the canvas** — a scaled host renders as a *scaling group*: a parent container styled as a box (visually distinct from a node), encasing one small replica node per running replica. A new replica pops into the group vertically when a scale-up completes; a removed replica disappears. At most 4 replica nodes are shown to avoid overwhelming the canvas; beyond 4, the group shows 4 nodes plus an overflow count (e.g. "+2"). The group is a visual projection only — the engine still simulates one host, edges attach to the group, and selecting the group or any replica opens the same host Inspector. This supersedes the original out-of-scope line "per-replica visualization as separate canvas nodes".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Watch a service scale out under rising load (Priority: P1)

An architect sets an API host to minReplicas 1 / maxReplicas 4 and ramps client load past the host's single-replica capacity. Saturation climbs; after it stays above the high watermark for the sustain window, a replica is added. During the boot delay latency keeps climbing; when the replica comes online, per-replica saturation and latency drop. Further load repeats the cycle until maxReplicas.

**Why this priority**: The scale-out loop with visible boot lag is the feature's core teaching value.

**Independent Test**: Ramp offered load on a 1–4 replica host to 3× single-replica capacity; verify replicas step 1→2→3 at the right saturation conditions, capacity relief arrives only after the boot delay, and the count never exceeds 4.

**Acceptance Scenarios**:

1. **Given** a host at 1 replica whose saturation stays above the high watermark for the sustain window and count < maxReplicas, **When** the scaler evaluates, **Then** the replica count increments by exactly one.
2. **Given** a replica was just added, **When** windows elapse within the boot delay, **Then** effective capacity is unchanged (latency continues to reflect the pre-scale capacity) until the delay expires.
3. **Given** the booted replica comes online, **When** the next window computes, **Then** per-replica load = incomingRPS ÷ new count and saturation/latency drop accordingly.
4. **Given** the count equals maxReplicas and saturation stays high, **When** the scaler evaluates, **Then** no further replicas are added and the host saturates/overloads per existing 011 behavior at the scaled capacity.
5. **Given** a brief saturation spike shorter than the sustain window, **When** the scaler evaluates, **Then** no scaling action fires (no flapping on transients).

---

### User Story 2 - Scale back in when load drops (Priority: P1)

When load falls and saturation stays below the low watermark for the sustain window, replicas are removed one at a time (respecting the cooldown between actions) down to minReplicas. Scale-down capacity change is immediate.

**Why this priority**: Without scale-in the loop is half a story; hysteresis between watermarks prevents flapping.

**Independent Test**: After scaling to 3 replicas, drop offered load to 10% of scaled capacity; verify stepwise 3→2→1 with at least the cooldown between actions, stopping at minReplicas.

**Acceptance Scenarios**:

1. **Given** a host at 3 replicas with saturation below the low watermark for the sustain window, **When** the scaler evaluates, **Then** the count decrements by exactly one and capacity reflects it in the next window.
2. **Given** a scale action just fired, **When** conditions still warrant another, **Then** the next action waits at least the cooldown interval.
3. **Given** the count equals minReplicas, **When** saturation is low, **Then** no further scale-down occurs.
4. **Given** saturation sits between the low and high watermarks, **When** the scaler evaluates, **Then** the count holds steady (hysteresis band).

---

### User Story 3 - Fixed replica count (Priority: P2)

A user who wants static horizontal scale sets minReplicas = maxReplicas = N: the host runs N replicas with no scaler dynamics. N = 1 reproduces 011 single-instance behavior exactly.

**Why this priority**: Gives the regression guarantee and a no-dynamics mode for scenario comparison.

**Independent Test**: min=max=1 host produces a metrics stream identical to 011 across an overload sweep; min=max=3 divides load by 3 with no scaling events ever.

**Acceptance Scenarios**:

1. **Given** minReplicas = maxReplicas = 1, **When** any load profile runs, **Then** all host metrics equal the pre-feature single-instance values (regression).
2. **Given** minReplicas = maxReplicas = 3, **When** load varies arbitrarily, **Then** replica count stays 3 and no scaling events are emitted.

---

### User Story 4 - See the scaling group grow and shrink on the canvas (Priority: P2)

A scaled host renders as a **scaling group**: a box-styled parent container encasing one small replica node per running replica. When a scale-up completes, a new replica node pops into the group, stacking vertically; on scale-down one disappears. Up to 4 replica nodes are shown; beyond that the group displays 4 plus an overflow count. The Inspector shows currentReplicaCount, per-replica saturation, and recent scaling events ("scaled up to 3 at t=12.4s").

**Why this priority**: The loop must be observable to teach — watching nodes appear is the payoff; but it rides on telemetry from Stories 1–2.

**Independent Test**: Ramp load on a 1–6 replica host: verify the group grows 1→2→3→4 visible replica nodes stacking vertically, then shows "+1"/"+2" overflow at counts 5–6, and shrinks back as load drops.

**Acceptance Scenarios**:

1. **Given** a host with minReplicas = maxReplicas = 1, **When** rendered, **Then** it appears as a plain host node — no group box.
2. **Given** a host whose replica count is 2–4, **When** rendered, **Then** a box-styled group (visually a container, not a node) encases exactly that many replica nodes, stacked vertically.
3. **Given** a scale-up completes (boot delay elapsed), **When** the next window renders, **Then** a new replica node appears inside the group; on scale-down one disappears.
4. **Given** a replica count above 4, **When** rendered, **Then** the group shows 4 replica nodes plus an overflow indicator with the remainder (e.g. "+2"), and the true count in its label/badge.
5. **Given** a user clicks the group box or any replica node inside it, **When** the Inspector opens, **Then** it shows the single host's config and telemetry (one host, one config — replicas are not individually configurable).
6. **Given** edges attached to a scaled host, **When** the group grows or shrinks, **Then** edges stay attached to the group (never to individual replicas) and the canvas layout around the group remains stable.
7. **Given** a scaling action fires, **When** the next window renders, **Then** the group shows a distinct transient treatment and the Inspector's event list gains an entry with direction, new count, and simulated time.
8. **Given** a scaled host is selected, **When** the formula panel opens, **Then** per-replica load division and the threshold scaling policy appear as formulas with live inputs and at least one citation (e.g., Kubernetes HPA documentation or autoscaling literature).

---

### Edge Cases

- **min > max entered in the Inspector**: rejected by field validation (min ≤ max enforced at input; engine also guards).
- **maxReplicas reached while overloaded**: host sheds/overloads per 011 semantics at replicas × per-replica capacity; `maxRPS` clamp and shedding apply per replica.
- **Scaled consumer draining a queue**: the queue's drain capacity reflects replicas × per-replica remaining capacity — scaling a consumer visibly accelerates backlog drain.
- **Simulation reset**: replica count returns to minReplicas; scaling event history clears; boot timers cancel.
- **Config edit mid-run** (min/max changed): count re-clamps into the new [min, max] on the next window; in-flight boot timers for replicas beyond the new max are cancelled.
- **Non-scaling profiles**: client_pool and external_api never expose or apply replica parameters; queues never scale (zero-config rule).
- **Determinism**: identical topology + load profile ⇒ identical scaling event sequence (windowed threshold evaluation, no randomness).
- **Old diagrams**: hosts saved before this feature import with minReplicas = maxReplicas = 1 (exact 011 behavior).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Saturating host profiles (transactional API, worker/consumer, database) MUST accept exactly two new parameters: `minReplicas` and `maxReplicas` (integers ≥ 1, min ≤ max). `client_pool` and `external_api` MUST NOT expose them; queues remain zero-config.
- **FR-002**: `currentReplicaCount` MUST be runtime telemetry, initialized to minReplicas, never a user input, always within [minReplicas, maxReplicas].
- **FR-003**: Per-window host math MUST divide incoming load across replicas (per-replica load = incomingRPS ÷ currentReplicaCount) and apply the existing 011 saturation/latency formulas per replica, in both manual and calculated config modes; `manualMaxRPS` clamping and shedding apply per replica.
- **FR-004**: The auto-scaler MUST add one replica when saturation has exceeded the high watermark for the sustain window and count < maxReplicas; remove one when saturation has stayed below the low watermark for the sustain window and count > minReplicas; and otherwise hold (hysteresis band).
- **FR-005**: Scaling watermarks, sustain window, cooldown between actions, and boot delay MUST be internal tunables in the central engine config — not user parameters.
- **FR-006**: A newly added replica MUST NOT contribute capacity until the boot delay elapses; scale-down takes effect immediately.
- **FR-007**: At most one scaling action may fire per cooldown interval per host.
- **FR-008**: Scaling MUST be deterministic: same topology, parameters, and load profile produce the same event sequence.
- **FR-009**: Telemetry MUST include currentReplicaCount, per-replica saturation, and a bounded list of recent scaling events (direction, new count, simulated time), delivered through the existing windowed metrics path.
- **FR-010**: A host whose replica count exceeds 1 (or whose bounds allow scaling) MUST render as a scaling group: a box-styled parent container visually distinct from nodes, encasing one replica node per running replica, stacked vertically, growing/shrinking as scaling actions complete. All animation values remain bounded.
- **FR-010a**: At most 4 replica nodes are rendered per group; counts above 4 show 4 nodes plus an overflow indicator with the remainder, and the true count on the group.
- **FR-010b**: The scaling group is a visual projection of telemetry only: the engine simulates one host; edges attach to the group, never to individual replica nodes; selecting the group or any replica opens the same host Inspector; replica nodes are never serialized into topology JSON and are not individually configurable, draggable outside the group, or connectable.
- **FR-010c**: The canvas MUST show a distinct transient treatment on the group when a scaling action fires.
- **FR-011**: Queue drain capacity toward a scaled consumer MUST reflect replicas × per-replica remaining capacity.
- **FR-012**: Per-replica load division and the scaling policy MUST ship formula descriptors with at least one cited source (e.g., Kubernetes HPA policy documentation or autoscaling literature).
- **FR-013**: min = max MUST disable scaler dynamics entirely; min = max = 1 MUST reproduce pre-feature host metrics exactly. Hosts from diagrams saved before this feature import as min = max = 1.
- **FR-014**: `reset()` MUST return counts to minReplicas, clear event history, and cancel pending boot timers.
- **FR-015**: This feature MUST include the constitution amendment to Principle I admitting `minReplicas`/`maxReplicas` (MINOR bump), landing with the feature.

### Key Entities

- **Replica bounds**: the two new host parameters (minReplicas, maxReplicas) bounding the scaler.
- **Replica state**: per-host runtime — current count, booting replicas with remaining boot time, last-action timestamp (cooldown), saturation sustain tracker.
- **Scaling event**: telemetry record (direction, new count, simulated time) surfaced in the Inspector.
- **Scaling group visual**: box-styled parent container encasing up to 4 replica nodes (plus overflow indicator) — a render-only projection of replica telemetry, never part of the simulated or serialized topology.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 1→4 replica ramp scenario, scale-up events fire only after saturation exceeds the high watermark for the full sustain window, and capacity relief is delayed by exactly the boot delay — observable as a latency peak followed by a drop.
- **SC-002**: A load drop to 10% of scaled capacity produces stepwise scale-down to minReplicas with at least the cooldown between events, and no oscillation (no up-down-up within three consecutive evaluations) at steady load anywhere in the hysteresis band.
- **SC-003**: min = max = 1 hosts produce metric streams identical to pre-feature behavior across an overload sweep (regression guarantee).
- **SC-004**: Two runs with identical inputs produce identical scaling event sequences (determinism).
- **SC-005**: The Inspector exposes exactly two new inputs; replica count, per-replica saturation, and scaling events are visible; scaling formulas carry ≥1 citation.
- **SC-008**: Across a 1→6→1 replica sweep, the on-canvas group always shows min(count, 4) replica nodes with the correct overflow remainder, replica nodes appear/disappear only when scaling actions complete, and exported topology JSON contains zero replica sub-nodes.
- **SC-006**: A user can demonstrate "system absorbs 3× load by scaling out, then scales back in" in under 5 minutes without documentation.
- **SC-007**: Canvas fluidity is preserved at the 011 performance bar (≥30 nodes, ≥10,000 req/s) with scaling active on every host.

## Assumptions

- **Scaler policy shape** (watermarks ~0.80/~0.30, one-step actions, sustain + cooldown) follows the product owner's sketch and common HPA-style practice; exact tunable values are an engine decision at planning time.
- **Saturation input to the scaler** is the per-replica saturation ratio already computed by 011 host math, evaluated per metrics window.
- **Boot delay applies only to scale-up**; connection draining on scale-down is explicitly out of scope.
- **Serialization**: replica bounds serialize with the host sim payload; absence in old JSON means min = max = 1 (documented migration per constitution III).
- **012 interaction**: if overload-collapse lands, collapse applies to per-replica goodput; no coupled behavior is specified here and neither feature depends on the other.
- **Visible replica cap (4)** and group layout metrics (replica node size, vertical spacing, box padding) are internal design tokens/tunables, not user parameters.
- **Booting replicas** render inside the group with a distinct pending treatment (they exist but don't yet serve traffic), so the boot-delay lag is visible.
- **Out of scope**: vertical scaling, scale-to-zero, cost modeling, scheduled/predictive scaling, custom scaling policies, per-replica configuration or per-replica edges (replica nodes are visual projections only).
