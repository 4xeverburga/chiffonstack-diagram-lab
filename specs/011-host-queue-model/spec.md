# Feature Specification: Generalized Host/Queue Simulation Model

**Feature Branch**: `011-host-queue-model`

**Created**: 2026-07-06

**Status**: Draft

**Input**: User description: "Generalized Host/Queue simulation model (SUGAR core re-scope). Replace the current role-based sim model (generator/processor/producer/consumer/sink plus the deep Kafka node) with exactly two simulated node kinds: Host nodes (the modeling focus) and Queue nodes (deliberately generic), with traffic configuration carried on edges."

## Overview

SUGAR's audience — data engineers and system architects — already understands queues; what they struggle to rightsize is **compute**: how services with different workloads interact, where saturation appears first, and how latency explodes past the knee of the curve. This feature re-centers the simulation on that problem. The node model collapses to two simulated kinds:

- **Host nodes** — richly modeled compute (client pools, APIs, workers, databases, external dependencies) with saturation and latency behavior.
- **Queue nodes** — deliberately shallow, technology-agnostic buffers that report throughput and backlog telemetry only.

The existing deep Kafka model (disk cliff, page cache, TLS/compression multipliers, hardware profiles) is retired, along with its configuration surface. Traffic shape (fan-out share, payload size, compute weight, path latency) moves onto edges.

The parameter set is **closed**: the only user-facing simulation inputs are those enumerated in FR-020. No other resource dimensions (network bandwidth ceilings, disk/IO read velocity, RAM/page-cache modeling) may be introduced under this spec.

## Clarifications

### Session 2026-07-06

- Q: What does `manualMaxRPS` do (declared in the original sketch but referenced by no formula)? → A: It is the cap before the server starts throwing errors and collapsing (roughly the rate at which latency has exploded past acceptable, ~1/maxLatency): the host's throughput hard-clamps at `manualMaxRPS`; offered load beyond it is shed (not forwarded downstream). No error-rate or retry modeling in v1.
- Q: How is a queue's outflow (drain rate) determined? → A: Derived entirely from downstream consumer hosts — the sum of what they can still accept (remaining capacity, converted to MB/s via edge payload size). Queue nodes carry zero configuration parameters.
- Q: What composes a host's base latency in calculated mode (before the ρ/(1−ρ) penalty)? → A: `cpuProcessingTimeMs` + the traffic-weighted average of its outbound edges' `pathIoLatencyMs`, per the original sketch. Manual mode uses `manualBaselineLatencyMs`.
- Directive: the simulation parameter set is closed to the fields in the product owner's original SUGAR sketch (encoded as FR-020); adding parameters beyond that list is out of scope for this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Model a service chain and watch it saturate (Priority: P1)

An architect drops a client pool, an API host, and a database host on the canvas, connects them, sets the client pool's request rate, and starts the simulation. As they raise the rate, they watch each host's saturation ratio climb and its latency follow a smooth "hockey stick": flat at low load, exploding as saturation approaches 100%. Edges into an overloaded host turn congested (red) on the canvas.

**Why this priority**: This is the core value of the re-scope — compute rightsizing intuition. Without it nothing else in the feature matters.

**Independent Test**: Build a 3-host chain (client pool → API → database), sweep the client RPS from low to past the API's capacity, and verify saturation, latency growth, and edge congestion appear in the correct order with no discontinuous jumps.

**Acceptance Scenarios**:

1. **Given** a client pool at 100 req/s feeding an API host whose capacity is 500 req/s, **When** the simulation runs, **Then** the API shows saturation ≈ 20% and latency ≈ its baseline.
2. **Given** the same topology, **When** the client rate is raised to 480 req/s, **Then** the API's reported latency is visibly higher than baseline and grows smoothly (no step change) as the rate approaches 500 req/s.
3. **Given** a host whose saturation exceeds the congestion threshold, **When** the next metrics window is rendered, **Then** every edge targeting that host is marked congested on the canvas.
4. **Given** an offered load above a host's capacity, **When** the simulation runs, **Then** latency remains finite (no infinities or NaN reach the UI).

---

### User Story 2 - Configure hosts two ways: known capability or derived capacity (Priority: P1)

A user who has load-tested their service enters its known capability directly (baseline latency, saturation point, max rate). A user who hasn't enters what they do know (per-request CPU time and worker/thread count) and the simulation derives the capacity, weighting requests by the compute-weight multiplier of the inbound edges that carry them.

**Why this priority**: The dual input mode is what makes host modeling usable for both "I measured it" and "help me estimate it" users; it ships with Story 1 as the same Inspector surface.

**Independent Test**: Configure one host in manual mode and an identical host in calculated mode with equivalent numbers; verify both saturate at the same offered load.

**Acceptance Scenarios**:

1. **Given** a host in manual mode with saturation point 500 req/s, **When** offered 500 req/s, **Then** its saturation ratio reads 100%.
2. **Given** a host in calculated mode with 10 ms CPU time per request and 8 worker threads, **When** offered 800 req/s of weight-1.0 traffic, **Then** its saturation ratio reads 100% (8 threads ÷ 0.010 s = 800 req/s capacity).
3. **Given** a calculated-mode host with two inbound edges whose compute-weight multipliers differ (e.g. 1.0 and 3.0), **When** traffic flows on both, **Then** the heavier edge's requests consume proportionally more capacity in the saturation calculation.
4. **Given** an external-API host, **When** offered any load, **Then** its saturation is always 0% and its latency is always its configured baseline.

---

### User Story 3 - Watch a generic queue absorb and drain backlog (Priority: P2)

A data engineer places a queue node between a producer host and a consumer host. When the producer's outbound data rate exceeds what the consumer drains, the queue's backlog grows; when the consumer catches up, the backlog drains. The queue's telemetry (throughput in/out, accumulated backlog) is visible per metrics window, with no technology-specific configuration required.

**Why this priority**: Queues remain necessary connective tissue in realistic topologies, but they are intentionally shallow — telemetry over modeling.

**Independent Test**: Producer at 20 MB/s into a queue drained at 10 MB/s: backlog grows ~10 MB per second of simulated time; drop the producer to 5 MB/s and the backlog shrinks.

**Acceptance Scenarios**:

1. **Given** inbound 20 MB/s and downstream drain capacity 10 MB/s, **When** the simulation runs for 60 simulated seconds, **Then** the queue reports ~0.6 GB accumulated backlog.
2. **Given** a queue with accumulated backlog and inbound rate below drain capacity, **When** the simulation continues, **Then** backlog decreases monotonically toward zero and never goes negative.
3. **Given** a queue node selected on the canvas, **When** the Inspector opens, **Then** it shows telemetry (throughput in/out, backlog) and no technology-specific configuration fields.

---

### User Story 4 - Shape traffic on edges (Priority: P2)

A user selects an edge and configures how traffic flows across it: what share of the source's output it carries, the average payload size, how expensive its requests are for the target, and the path's I/O latency. Edge telemetry shows the resulting request rate, data rate, and estimated open connections. Shares are independent per edge (not normalized against a source's other edges), so the same mechanism expresses both a probabilistic split (shares summing to 1) and a broadcast/sequential fan-out (multiple edges each at 1.0).

**Why this priority**: Edge-level traffic shaping is what makes fan-out topologies expressible; it feeds Stories 1–3 but each of those is demonstrable with default edge values.

**Independent Test**: One source fanned out to two targets with shares 0.7/0.3; verify edge request rates split 70/30 and MB/s follows each edge's payload size. Separately, a source with two edges both at share 1.0 must forward the full upstream rate to each (broadcast, not split).

**Acceptance Scenarios**:

1. **Given** a host emitting 1,000 req/s with two outbound edges at shares 0.7 and 0.3, **When** the simulation runs, **Then** the edges report 700 and 300 req/s respectively.
2. **Given** an edge carrying 100 req/s with 50 KB average payload, **When** metrics update, **Then** the edge reports ≈ 4.88 MB/s.
3. **Given** an edge carrying 200 req/s whose target responds at 250 ms, **When** metrics update, **Then** the edge reports ≈ 50 active connections (rate × latency).
4. **Given** any edge, **When** its throughput changes, **Then** its flow animation speed updates through the existing animation pipeline (faster at higher throughput).

---

### User Story 5 - Formulas remain traceable (Priority: P3)

A user selects any host, queue, or edge during simulation and opens the formula panel. Every computed metric (saturation, latency, backlog, connections, congestion) lists the formula used, its current input values, and at least one cited source (e.g., queueing-theory or Little's-law references).

**Why this priority**: Traceability is a standing product principle; it extends to the new model but doesn't gate the model itself.

**Independent Test**: Select a saturated host and verify the panel lists the saturation and latency formulas with live inputs and source citations.

**Acceptance Scenarios**:

1. **Given** a running simulation, **When** a host is selected, **Then** the formula panel lists its saturation and latency formulas with current input values and at least one source each.
2. **Given** a running simulation, **When** an edge is selected, **Then** the active-connections formula (Little's law) is listed with a source.

---

### Edge Cases

- **Cycles**: A topology with a loop (API → DB → API) is rejected with the existing cycle error naming the offending nodes; the simulation must not hang or feed back infinitely.
- **Saturation ≥ 100%**: Offered load above capacity must not produce infinite/NaN latency; the saturation input to the latency curve is clamped just below 1 so latency is huge but finite, and displayed saturation may exceed 100% to show overload magnitude.
- **Zero/absent values**: A host with zero capacity (0 threads, 0 saturation RPS), an edge with 0% share, or a payload of 0 KB must yield zero flow, not division errors.
- **Fan-out shares that sum to more than 1**: This is expected, not an error — a source's outbound `trafficShareRatio` values are independent per-edge multipliers, not normalized against each other. A ratio of 1.0 on multiple edges models a host making sequential/parallel calls to several downstream services per request (each gets 100% of the source's output); ratios that sum to 1 across a set of edges model a probabilistic split/branch instead. Both patterns — and any mix of the two — are valid on the same source.
- **Disconnected nodes**: A host or queue with no inbound edges simply reports zero traffic (unless it is a client pool, which generates its own).
- **Existing saved diagrams**: Diagrams containing retired node roles (generator/processor/producer/consumer/sink/Kafka) must not crash the app on load — they degrade to non-simulated visual nodes (see Assumptions).
- **Queue at the topology edge**: A queue with no downstream consumer accumulates backlog indefinitely (unbounded by design); the telemetry must remain numerically stable over long runs.
- **Offered load beyond `manualMaxRPS`**: Throughput forwarded downstream clamps at `manualMaxRPS`; the excess is shed without error/retry modeling, while displayed saturation continues to reflect the full offered load.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The simulation MUST support exactly two simulated node kinds: Host and Queue. The prior roles (generator, processor, producer, consumer, sink, Kafka) MUST be removed from the palette, Inspector, and engine.
- **FR-002**: Host nodes MUST carry a runtime profile: client pool, transactional API, worker/consumer, database, or external API.
- **FR-003**: A client-pool host MUST be configurable with a single request-rate parameter (req/s) and act as a traffic source; it MUST NOT require or expose concurrent-user or think-time settings.
- **FR-004**: An external-API host MUST never saturate (saturation always 0) and MUST always report its configured baseline latency.
- **FR-005**: Every non-source host MUST support two configuration modes: **manual** (`manualBaselineLatencyMs`, `manualSaturationRPS`, `manualMaxRPS` — the user's known capability curve) and **calculated** (`cpuProcessingTimeMs`, `maxWorkerThreads`, from which capacity is derived).
- **FR-005a**: In manual mode, `manualMaxRPS` is a hard throughput ceiling — the collapse point: the host's processed/forwarded rate MUST clamp at `manualMaxRPS`, and offered load beyond it is shed (not propagated downstream). Displayed saturation still reflects the full offered load. No error-rate, retry, or crash modeling in v1.
- **FR-006**: In calculated mode, per-request cost MUST be weighted by the compute-weight multiplier of the inbound edge carrying the request, so heavier request types consume proportionally more capacity.
- **FR-007**: Each host MUST report a saturation ratio each metrics window: offered load relative to capacity for its active configuration mode.
- **FR-008**: Each host MUST report a latency that follows a smooth, continuous queueing curve: at low saturation it approximates the base latency; as saturation approaches 100% it grows without a step discontinuity, using a penalty proportional to ρ/(1−ρ) scaled by the base latency, with ρ clamped below 1 so results stay finite.
- **FR-008a**: Base latency is composed only from existing parameters: manual mode uses `manualBaselineLatencyMs`; calculated mode uses `cpuProcessingTimeMs` plus the traffic-weighted average of the host's outbound edges' `pathIoLatencyMs` (downstream I/O wait). No additional latency parameters may be introduced.
- **FR-009**: Traffic MUST propagate through the topology in dependency order each window: source hosts emit their generated rate; every downstream node's incoming rate is the sum of its inbound edges' rates. Topologies with cycles MUST be rejected with the existing cycle-detection error.
- **FR-010**: Queue nodes MUST be generic, unbounded buffers with **zero configuration parameters**; their telemetry MUST include throughput in (MB/s), throughput out (MB/s), and accumulated backlog (GB) that grows when inflow exceeds outflow and drains (never below zero) when outflow exceeds inflow.
- **FR-010a**: A queue's outflow MUST be derived entirely from its downstream consumer hosts — the sum of what each can still accept given its remaining capacity, converted to MB/s via the connecting edge's `averagePayloadSizeKB`. No queue-level drain-rate, capacity, or technology parameter exists.
- **FR-011**: The deep Kafka model and its configuration/metrics surfaces (hardware profiles, partitions, replication, TLS/compression, disk cliff, page cache, Kafka metrics panel and Inspector fields) MUST be removed.
- **FR-012**: Edges MUST carry the traffic configuration: traffic-share ratio (portion of the source's output), average payload size (KB), target compute-weight multiplier, and path I/O latency (ms).
- **FR-013**: Edge telemetry each window MUST include: request rate (source output × share), data rate (rate × payload size), and estimated active connections via Little's law (rate × latency).
- **FR-014**: An edge MUST be flagged congested when its target's saturation exceeds a centrally configured threshold, and the canvas MUST render congested edges distinctly (red treatment).
- **FR-015**: Edge flow-animation speed MUST continue to derive from edge throughput through the existing animation pipeline.
- **FR-016**: Every computed host, queue, and edge metric MUST ship a formula descriptor (name, expression, live inputs, cited sources) for the Inspector formula panel; descriptors without sources MUST be rejected as they are today.
- **FR-017**: All model tunables (congestion threshold, saturation clamp, latency-penalty scaling, normalization rules) MUST live in the existing centralized engine configuration.
- **FR-018**: Loading a previously saved diagram that contains retired node kinds MUST NOT crash; such nodes degrade to non-simulated visual elements.
- **FR-019**: The simulation MUST retain its existing delivery characteristics: engine isolated from the UI, metrics delivered as aggregated windows (never per event), and canvas fluidity preserved at high request rates.
- **FR-020**: **Closed parameter set.** The complete, exhaustive list of user-facing simulation input parameters is:
  - Host, client-pool profile: `requestRatePerSec`.
  - Host, manual mode: `manualBaselineLatencyMs`, `manualSaturationRPS`, `manualMaxRPS`.
  - Host, calculated mode: `cpuProcessingTimeMs`, `maxWorkerThreads`.
  - Edge: `trafficShareRatio`, `averagePayloadSizeKB`, `targetComputeWeightMultiplier`, `pathIoLatencyMs`.
  - Queue: *(none)*.

  No other simulation input may be added under this spec. Explicitly excluded dimensions (do not reintroduce from the retired Kafka model): network bandwidth ceilings, disk/IO read or write velocity, RAM sizing, page-cache behavior, hardware instance profiles, replication factors, partition counts, compression/TLS toggles. Internal engine tunables (thresholds, clamps) live in central config and are not user-facing parameters.

### Key Entities

- **Host node**: A compute element with a runtime profile, a configuration mode (manual capability vs. calculated capacity), and per-window telemetry (incoming rate, saturation ratio, computed latency).
- **Queue node**: A generic unbounded buffer with telemetry only (throughput in/out, accumulated backlog). No technology identity.
- **Edge**: A directed connection carrying traffic configuration (share, payload size, compute weight, path latency) and per-window telemetry (request rate, data rate, active connections, congestion flag, animation speed).
- **Metrics window**: The periodic aggregated snapshot delivering all node and edge telemetry plus formula descriptors to the UI.
- **Formula descriptor**: The traceability record for one computed metric — name, expression, live input values, and cited sources.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can build the client → API → database scenario and observe correct saturation ordering (first bottleneck saturates first) within 5 minutes of opening the app, with no documentation.
- **SC-002**: Sweeping offered load from 10% to 99% of a host's capacity produces a strictly increasing, continuous latency curve — no visible step at any threshold — and latency at 95% saturation is at least 5× baseline.
- **SC-003**: Manual and calculated configuration modes with equivalent inputs agree on the saturation point within 1%.
- **SC-004**: With a producer/consumer imbalance of X MB/s, queue backlog growth matches X × elapsed simulated time within 5% over a 60-second run.
- **SC-005**: 100% of computed metrics visible in the Inspector expose a formula with at least one cited source.
- **SC-006**: The canvas remains fluid (no dropped interaction) with topologies of at least 30 simulated nodes at aggregate offered load of 10,000 req/s, matching the existing engine's performance bar.
- **SC-007**: Zero references to the retired Kafka-specific model remain in the product UI (palette, Inspector, metrics panels).
- **SC-008**: The configuration surface exposed to users (Inspector fields across hosts, queues, and edges) matches the FR-020 closed parameter list exactly — no extra input fields, none missing.

## Assumptions

- **Migration of saved diagrams**: Retired-role nodes in previously saved/exported diagrams degrade to plain visual (non-simulated) nodes rather than being auto-converted; users re-assign kinds manually. Chosen because pre-pivot diagrams are decorative and the product has no persistence guarantees yet.
- **Fan-out share independence**: A source's outbound `trafficShareRatio` values are NOT normalized against each other — each edge is an independent multiplier on the source's output. Shares summing to 1 across a source's edges model a probabilistic split (e.g. a load-balanced route); a ratio of 1.0 on more than one edge models sequential/parallel calls to multiple downstream services per request (broadcast fan-out). Both patterns, and any mix, coexist on the same source; there is no total to enforce.
- **Displayed saturation above 100%** is allowed (shows overload magnitude); only the latency-curve input is clamped below 1.
- **Worker/consumer, transactional API, and database profiles** share the same saturation/latency mathematics in this spec; profiles primarily set defaults and Inspector labeling. Behavioral differentiation between profiles is future work.
- **Queue units**: Queue telemetry is data-rate based (MB/s, GB backlog), converted from request rates via edge payload sizes.
- **Stress-tool integration (JMeter/Locust), autoscaling/replicas, crash states (OOM), and global backpressure indices are explicitly out of scope**, per the product decision of 2026-07-06.
- The existing simulation delivery architecture (isolated engine, windowed metrics, animation smoothing) is reused as-is; this feature changes the domain model, not the delivery machinery.
