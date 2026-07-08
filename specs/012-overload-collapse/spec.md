# Feature Specification: Overload Collapse Mode for Host Nodes

**Feature Branch**: `012-overload-collapse`

**Created**: 2026-07-06

**Status**: Draft

**Input**: User description: "Add a per-host overload behavior switch: 'clamp' (current plateau behavior) vs 'collapse' (goodput decays smoothly toward zero past the knee, as in real congestion collapse). Default 'collapse'. One new parameter only; curve shape derived from existing parameters plus internal tunables. Requires a constitution amendment to the closed parameter set."

## Overview

In feature 011, an overloaded host *plateaus*: forwarded throughput clamps at its cap and the excess is shed, while latency explodes on the ρ/(1−ρ) curve. Real systems usually behave worse — past the saturation knee, goodput *falls* as offered load rises (connection-pool exhaustion, retry amplification, GC/context-switch overhead), the classic retrograde throughput curve of congestion collapse. Teaching that distinction is core SUGAR value for its audience.

This feature adds exactly **one** new user-facing parameter: a per-host overload behavior switch, `clamp | collapse`, defaulting to `collapse` for new hosts. The collapse curve's shape is derived entirely from the host's existing capability parameters plus internal engine tunables — no new numeric knobs. Admitting the parameter requires a constitution amendment to Principle I (closed parameter set); that amendment is in scope for this feature (MINOR bump).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Watch a host collapse under overload (Priority: P1)

An architect overloads an API host configured with `collapse` behavior. As offered load passes the knee, the host's forwarded goodput bends back down toward zero instead of plateauing, its status becomes `collapsed`, and the node renders with a distinct treatment. Backing the load off recovers the host along the same curve.

**Why this priority**: The retrograde goodput curve is the entire feature.

**Independent Test**: Sweep offered load from 50% to 300% of capacity on a collapse-mode host; verify goodput rises, peaks near capacity, then decays smoothly toward ~zero; sweep back down and verify symmetric recovery.

**Acceptance Scenarios**:

1. **Given** a collapse-mode host with capacity 500 req/s offered 400 req/s, **When** the simulation runs, **Then** forwarded goodput ≈ 400 req/s (below the knee, collapse and clamp behave identically).
2. **Given** the same host offered 2× capacity, **When** the simulation runs, **Then** forwarded goodput is visibly *below* its peak (retrograde region), latency is far above baseline, and `shedRPS` = offered − forwarded.
3. **Given** the same host offered 5× capacity or more, **When** the simulation runs, **Then** goodput approaches zero, stays finite and non-negative, and status reads `collapsed`.
4. **Given** offered load swept continuously across the knee, **When** metrics update each window, **Then** the goodput curve is smooth — no step or kink at any threshold.
5. **Given** offered load drops back below the knee, **When** the next windows compute, **Then** the host recovers immediately along the same curve (no sticky failure state).

---

### User Story 2 - Choose clamp vs collapse per host (Priority: P1)

A user selects a host in the Inspector and picks its overload behavior. `clamp` preserves the 011 plateau; `collapse` enables the retrograde curve. New hosts default to `collapse`. The switch appears only on profiles where overload is meaningful.

**Why this priority**: The switch is the single new parameter; without it collapse can't ship without silently changing every existing model.

**Independent Test**: Two identical hosts, one per mode, same overload sweep: clamp host plateaus at its cap; collapse host decays past the knee. Below the knee both report identical numbers.

**Acceptance Scenarios**:

1. **Given** a host in `clamp` mode offered 2× capacity, **When** the simulation runs, **Then** forwarded throughput equals its 011 plateau value (behavior unchanged).
2. **Given** a newly created non-source host, **When** the Inspector opens, **Then** overload behavior reads `collapse`.
3. **Given** a client-pool or external-API host, **When** the Inspector opens, **Then** no overload-behavior control is shown (sources generate, bottomless dependencies never saturate).
4. **Given** a diagram saved before this feature, **When** it is imported, **Then** its hosts behave as `clamp` (the behavior they were built with), not the new default.

---

### User Story 3 - Downstream starvation and upstream backlog (Priority: P2)

A collapsed host starves its downstream dependencies (outbound edges carry its near-zero goodput) and backs up its upstream queues (a queue feeding a collapsed consumer accumulates backlog faster).

**Why this priority**: Collapse only teaches system-level lessons if its effects propagate; but it rides entirely on 011's existing propagation once goodput is correct.

**Independent Test**: chain A → collapsed B → C with a queue Q feeding B: verify C's incoming rate ≈ B's collapsed goodput and Q's backlog growth rate rises as B collapses.

**Acceptance Scenarios**:

1. **Given** a collapsed host with goodput ≈ 0, **When** windows update, **Then** every outbound edge reports that near-zero rate and downstream hosts show correspondingly low incoming RPS.
2. **Given** a queue whose only consumer is a collapsing host, **When** the consumer's acceptable rate falls, **Then** the queue's outflow falls with it and backlog growth accelerates accordingly.

---

### User Story 4 - Collapse formula is traceable (Priority: P2)

Selecting a collapse-mode host shows the collapse/goodput formula with live inputs and citations from congestion-collapse literature alongside the existing saturation/latency descriptors.

**Why this priority**: Standing constitution II requirement; merge-blocking but not the feature's core.

**Acceptance Scenarios**:

1. **Given** a running simulation with a collapse-mode host selected, **When** the formula panel opens, **Then** the goodput/collapse formula is listed with current input values and at least one cited source (e.g., receive-livelock or congestion-collapse literature).

---

### Edge Cases

- **Exactly at the knee**: clamp and collapse must agree at the knee point itself; divergence begins only past it (continuity requirement).
- **Zero capacity**: a collapse-mode host with zero capacity forwards zero at any load — no NaN/Infinity from the decay math.
- **Extreme overload (100× capacity)**: goodput underflows gracefully toward zero, remains ≥ 0 and finite; canvas animation stays bounded (constitution V).
- **Mode switch mid-run**: changing clamp ↔ collapse while the simulation runs takes effect on the next window like any other config edit; no engine restart required.
- **Manual mode interplay with `manualMaxRPS`**: in clamp mode `manualMaxRPS` remains the plateau; in collapse mode the same parameter anchors where decay becomes severe — it must not act as a second independent knob.
- **Latency during collapse**: latency continues on its explosive curve (or holds at its clamped maximum); it must never *improve* as goodput collapses.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Non-source, non-bottomless hosts (transactional API, worker/consumer, database profiles) MUST carry an overload-behavior switch `overloadBehavior: 'clamp' | 'collapse'` — the only new user-facing parameter in this feature.
- **FR-002**: `clamp` MUST reproduce 011 behavior exactly: forwarded throughput plateaus at the host's cap; excess is shed.
- **FR-003**: `collapse` MUST produce a retrograde goodput curve: below the knee identical to clamp; past the knee forwarded goodput decreases smoothly and monotonically toward zero as offered load rises, always finite and ≥ 0, with no discontinuity at the knee.
- **FR-004**: The collapse curve's shape MUST be derived only from the host's existing capability parameters (manual: `manualSaturationRPS`/`manualMaxRPS`; calculated: derived capacity) plus internal tunables in the central engine config. No new numeric user inputs.
- **FR-005**: New hosts MUST default to `collapse`. Hosts in diagrams saved before this feature MUST import as `clamp` (preserving their previous behavior).
- **FR-006**: `client_pool` and `external_api` profiles MUST NOT expose or apply overload behavior.
- **FR-007**: Host status MUST gain a `collapsed` value, reported when a collapse-mode host operates past the knee with materially degraded goodput (threshold internal, in central config); the canvas MUST render `collapsed` distinctly from `overloaded`.
- **FR-008**: `shedRPS` telemetry MUST continue to equal offered − forwarded in both modes.
- **FR-009**: Collapse MUST propagate through existing mechanics: outbound edges carry collapsed goodput; queue drain toward a collapsing consumer falls with its acceptable rate; no new propagation rules.
- **FR-010**: Recovery MUST be stateless: goodput is a pure function of the current window's offered load (no hysteresis, no sticky failure). Stateful death spirals are out of scope.
- **FR-011**: The collapse/goodput formula MUST ship a formula descriptor with at least one citation from congestion-collapse / retrograde-throughput literature.
- **FR-012**: This feature MUST include the constitution amendment to Principle I admitting `overloadBehavior` into the closed parameter set (MINOR version bump), landing with the feature.
- **FR-013**: Latency in collapse mode MUST remain on its existing explosive curve and MUST NOT decrease as goodput collapses.

### Key Entities

- **Overload behavior switch**: the new per-host enum (`clamp | collapse`), part of host configuration for saturating profiles.
- **Goodput curve**: per-window forwarded throughput as a function of offered load — plateau (clamp) or retrograde (collapse).
- **`collapsed` status**: new host status value beyond `overloaded`, with its own canvas treatment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a collapse-mode host swept 0.5×→3× capacity, goodput peaks within 5% of capacity and falls to below 20% of peak by 3× offered load, with no discontinuity anywhere in the sweep.
- **SC-002**: At and below the knee, clamp and collapse modes report identical goodput/latency (within floating-point tolerance) for identical inputs.
- **SC-003**: A clamp-mode host's full metrics stream is unchanged from 011 across an overload sweep (regression guarantee).
- **SC-004**: Sweeping load up past collapse and back down produces symmetric goodput values at equal offered loads (stateless recovery).
- **SC-005**: Pre-012 saved diagrams import with all hosts behaving exactly as before (clamp), verified by comparing metric streams.
- **SC-006**: The Inspector exposes exactly one new control (the behavior switch) and the collapse formula appears with ≥1 citation (constitution II).
- **SC-007**: Users can demonstrate the difference between plateau and collapse on a two-host comparison in under 3 minutes without documentation.

## Assumptions

- **Curve family is an engine decision**: the specific retrograde function (e.g., goodput = capacity × decay(overload ratio)) is chosen at planning time from congestion-collapse literature; the spec constrains only its observable properties (smooth, monotone decreasing past knee, →0, finite, knee-continuous with clamp).
- **`collapsed` status threshold** (how degraded before status flips) is an internal tunable, not a user parameter.
- **Serialization**: `overloadBehavior` serializes with the host's sim payload; absence in old JSON means `clamp` (FR-005) — this is the documented migration per constitution III.
- **Latency at extreme overload** stays governed by the existing ρ-clamped curve; no separate collapse-latency model.
- **Constitution amendment text** mirrors FR-001/FR-004: one enum admitted, curve shape remains internal, future overload parameters still require amendment.
