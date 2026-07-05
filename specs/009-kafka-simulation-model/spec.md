# Feature Specification: Kafka Simulation Model

**Feature Branch**: `009-kafka-simulation-model`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "Kafka simulation model (feature 009, engine-side only — UI surface is feature 010). Deep, source-traceable Kafka model for the SUGAR engine, per constitution Principle I: Kafka node role with hardware profiles and Kafka parameters; producer/consumer roles with payload size and RPS→MB/s edge conversion; the three constitutional physics (network bandwidth saturation, vCPU saturation with TLS/compression multipliers, Disk Cliff) as named pure functions with structured source metadata; extended per-node metrics (saturation ratios, consumer lag, page cache hit ratio, derived status); FormulaDescriptor metadata exposed through the ports for feature 010 to render. Out of scope: UI changes, other technology models."

## User Scenarios & Testing *(mandatory)*

Feature 009 is engine-side: its "user interface" is the port boundary that
feature 010 and the existing canvas consume. Scenarios are written against
observable simulation behavior (metrics emitted per window), verifiable
through the engine's test harness and — once 010 lands — on the canvas.

### User Story 1 - Model a healthy Kafka cluster under load (Priority: P1)

An engineer assigns a Kafka role to a node, picks a hardware profile (e.g.
m6i.xlarge), sets partitions/replication/TLS/compression, connects a
producer (with rate and average payload size) and a consumer, and runs the
simulation. While demand stays under the cluster's physical limits, the
cluster reports healthy status, throughput equal to offered load, and near-zero
consumer lag.

**Why this priority**: the baseline case every other behavior deviates
from; proves hardware profiles, unit conversion, and the saturation
formulas compose end-to-end.

**Independent Test**: run a producer at a rate whose MB/s (rate × payload)
is well below the profile's network/CPU/disk limits; assert status
`healthy`, cluster throughput ≈ offered load (±5%), all saturation ratios
< 0.7, lag ≈ 0.

**Acceptance Scenarios**:

1. **Given** a producer at 1,000 msg/s × 1 KB payload into a Kafka node on
   a profile with ample bandwidth, **When** the simulation reaches steady
   state, **Then** the Kafka node reports ingress ≈ 1 MB/s, status
   `healthy`, and network/CPU/disk saturation ratios all below 0.7.
2. **Given** the same topology, **When** the producer edge is examined,
   **Then** its traffic is reported in both native units: requests/s on
   the producer side and MB/s entering the Kafka node (payload conversion).
3. **Given** a matched consumer (service capacity ≥ producer rate),
   **When** the simulation runs, **Then** consumer lag stays near zero and
   page cache hit ratio stays near 1.0.

---

### User Story 2 - Saturate the cluster and see which wall it hits (Priority: P2)

The engineer raises producer rate, payload size, or toggles TLS/compression,
and the cluster hits one of its three physical walls — network bandwidth,
vCPU, or disk. The metrics identify *which* resource saturated (the
bottleneck), throughput plateaus at the computed limit, and status degrades
to `saturated`.

**Why this priority**: bottleneck identification is the product's core
utility ("which wall do I hit first, and at what load?").

**Independent Test**: construct three configurations, each designed to make
a different resource the binding constraint; assert the corresponding
saturation ratio reaches ~1.0 first, throughput plateaus within 5% of the
analytically computed limit, and status becomes `saturated`.

**Acceptance Scenarios**:

1. **Given** offered ingress MB/s above the profile's network limit
   (accounting for replication egress), **When** steady state is reached,
   **Then** network saturation ≈ 1.0, throughput plateaus at the network
   limit, and unadmitted traffic accumulates as producer-side backlog.
2. **Given** TLS on and zstd compression on a CPU-constrained profile,
   **When** the same offered load runs with TLS/compression off vs on,
   **Then** CPU saturation is measurably higher with them on, per the
   documented multipliers, and the CPU-limited throughput ceiling is lower.
3. **Given** any saturated state, **When** the engineer reduces offered
   load below the binding limit, **Then** status returns to `healthy` and
   backlog drains.

---

### User Story 3 - Fall off the Disk Cliff and recover (Priority: P2)

The engineer under-provisions the consumer (or pauses it) so consumer lag
grows. While lag fits within the RAM available to the page cache, consumer
reads stay fast. When lag exceeds it, reads fall to disk speed: consumer
throughput collapses abruptly (the Disk Cliff), status becomes `degraded`,
and — because the consumer now drains slower — lag compounds. Restoring
consumer capacity lets lag shrink back inside the cache and throughput
recover.

**Why this priority**: the Disk Cliff is the signature Kafka behavior named
by the constitution; it is the demonstration that SUGAR models real physics
rather than linear toy math.

**Independent Test**: drive lag past the profile's page-cache RAM; assert
page cache hit ratio drops, consumer throughput falls to the disk-bound
value (within 5% of the analytic value), and status is `degraded`; then
restore capacity and assert recovery.

**Acceptance Scenarios**:

1. **Given** lag below the page-cache threshold, **When** windows are
   emitted, **Then** page cache hit ratio ≈ 1.0 and consumer throughput
   equals consumer capacity.
2. **Given** lag crossing the threshold, **When** the next windows are
   emitted, **Then** hit ratio falls toward the disk regime, consumer
   throughput drops to the disk-bound ceiling, and status is `degraded` —
   an abrupt transition, not a linear slope.
3. **Given** a recovered consumer draining lag back under the threshold,
   **When** steady state is reached again, **Then** throughput and status
   return to the cached regime.

---

### User Story 4 - Audit the math behind every number (Priority: P3)

Any consumer of the engine (feature 010's Inspector, a test, a curious
contributor) can ask, for a given node, which formulas are currently
governing its behavior and get — as data — each formula's name,
human-readable expression, current input values, and its sources (title,
URL, note).

**Why this priority**: constitution Principle II. P3 only because its
user-visible rendering ships in 010; the data contract must exist here.

**Independent Test**: for a Kafka node in each regime (healthy, network-
saturated, disk-cliff), request its formula descriptors; assert every
active formula appears with a non-empty source list and expression, and
that the *active* regime's formula is flagged as currently binding.

**Acceptance Scenarios**:

1. **Given** any Kafka node, **When** formula descriptors are requested,
   **Then** every formula that contributed to its current metrics is
   present, each with ≥1 source (title + URL).
2. **Given** a node in the disk-cliff regime, **When** descriptors are
   requested, **Then** the page-cache/disk formula is marked as the
   binding constraint and its current inputs (lag, cache RAM) are included.

---

### Edge Cases

- Payload size of zero or unset on a producer feeding a Kafka node:
  rejected at configuration time with a clear validation message (MB/s
  conversion is undefined without it).
- Replication factor exceeding what the modeled cluster can sustain (e.g.
  RF × ingress > egress capacity): egress becomes the binding wall; never
  silently ignored.
- Kafka node with producers but no consumers: lag grows unboundedly;
  simulation must remain stable (no overflow) and report the cliff when
  crossed; retention caps stored lag once reached.
- Consumer with no Kafka upstream (plain processor chain): behaves as in
  008 — Kafka-specific metrics simply absent.
- Hardware profile swapped mid-run: auto-pause rule from 008 applies
  (never silently ignored, never a crash).
- Extreme configs (1 partition; 10,000 partitions; TLS+zstd on the
  smallest profile): formulas stay bounded and status logic still resolves
  to exactly one of healthy/saturated/degraded.
- Legacy topologies (008 JSON without Kafka fields) load unchanged;
  pre-Kafka placeholder processors keep working.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a Kafka node role configurable with:
  a hardware profile from a built-in catalog, partition count, replication
  factor, TLS on/off, compression (none/zstd), and retention size.
- **FR-002**: The system MUST ship a hardware profile catalog of real
  instance shapes (at minimum: m6i.large, m6i.xlarge, m6i.2xlarge, m6i.4xlarge)
  where each profile declares vCPU count, RAM, network bandwidth, and disk
  throughput, each value carrying a source citation.
- **FR-003**: The system MUST provide producer and consumer roles: producer
  with message rate and average payload size; consumer with consumption
  capacity. Producer/consumer are distinct from the generic 008 roles,
  which remain available and unchanged.
- **FR-004**: Edges between rate-based components and Kafka nodes MUST
  convert units automatically (requests/s × average payload → MB/s), and
  per-edge metrics MUST be available in both units.
- **FR-005**: The system MUST model network saturation: cluster ingress and
  egress (including replication traffic and consumer egress) bounded by
  the profile's network bandwidth; throughput above the bound plateaus and
  excess accumulates as backlog/lag.
- **FR-006**: The system MUST model vCPU saturation with explicit,
  source-cited load multipliers for TLS and zstd compression; the
  CPU-bound throughput ceiling reflects profile vCPUs and active
  multipliers.
- **FR-007**: The system MUST model the Disk Cliff: RAM available to the
  page cache derives from the profile's RAM (minus a documented overhead);
  while consumer lag ≤ cache capacity, consumer reads run at cached speed;
  when lag exceeds it, consumer throughput falls to the disk-bound value —
  an abrupt regime change, with hysteresis-free deterministic thresholds.
- **FR-008**: Each simulation window MUST report, per Kafka node: ingress
  and egress MB/s, network/CPU/disk saturation ratios (0–1+), consumer lag
  (bytes and messages), page cache hit ratio, and a derived status —
  `healthy` (no ratio ≥ saturation threshold), `saturated` (a ratio at its
  wall), or `degraded` (disk-cliff regime).
- **FR-009**: Every formula MUST be a named, individually-testable pure
  function carrying structured source metadata (per source: title, URL,
  optional note), and the engine MUST expose, per node, the descriptors of
  all formulas governing its current behavior — name, human-readable
  expression, current input values, sources, and whether it is the
  currently binding constraint — as plain data across the ports
  (constitution Principle II). A formula without at least one source MUST
  NOT ship.
- **FR-010**: All Kafka behavior MUST be deterministic given the existing
  seed mechanism, and unit tests MUST pin each formula at documented
  operating points, including both sides of the disk-cliff threshold and
  each saturation wall.
- **FR-011**: Kafka configuration MUST serialize into topology JSON under
  the same whitelist rules as 008 (config persists; live metrics never);
  008-era topologies MUST load unchanged.
- **FR-012**: No UI changes ship in this feature. The existing Inspector
  continues to work for 008 roles; Kafka nodes remain selectable and
  configurable only insofar as the generic canvas allows (full Kafka UI is
  feature 010).

### Key Entities

- **Hardware profile**: named instance shape — vCPU, RAM, network
  bandwidth, disk throughput — with per-value source citations.
- **Kafka role config**: hardware profile reference + partitions,
  replication factor, TLS, compression, retention. Lives in node data;
  serialized.
- **Producer/consumer role config**: rate, average payload size (producer);
  consumption capacity (consumer). Serialized.
- **KafkaNodeMetrics**: per-window extension of node metrics — ingress/
  egress, saturation ratios, lag, page cache hit ratio, status. Transient.
- **FormulaDescriptor**: the auditability contract shared with feature 010
  — formula id, name, human-readable expression, current inputs, binding
  flag, and sources (title, URL, note). Transient data, exposed via ports.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For each of the three walls (network, CPU, disk), a
  purpose-built scenario reaches a throughput plateau within 5% of the
  analytically computed limit for the chosen profile.
- **SC-002**: The Disk Cliff reproduces as a regime change: crossing the
  lag threshold moves consumer throughput from the cached value to the
  disk-bound value within a small number of windows, not as a gradual
  slope — verified by automated test on both sides of the threshold.
- **SC-003**: 100% of shipped formulas have ≥1 source citation and a
  pinned-value unit test; the test suite fails if a formula is added
  without either (enforced structurally, not by review).
- **SC-004**: TLS and compression multipliers change the CPU-limited
  ceiling by their documented factors (±5%) when toggled, all else equal.
- **SC-005**: Identical seed + topology + config produce identical
  metric streams across runs (determinism preserved from 008).
- **SC-006**: All 008 behaviors remain green: existing engine tests pass
  unmodified, and 008-era topology JSON loads and simulates as before.

## Assumptions

- The model targets a **single-broker-equivalent cluster abstraction**: the
  hardware profile describes the whole modeled cluster node; per-broker
  distribution, rebalancing, and ISR dynamics are out of scope until a
  later feature. Partition count participates in formulas only where it
  materially changes the physics at this abstraction level (e.g. CPU
  overhead factor), and its formula must say so honestly.
- Initial hardware catalog is AWS m6i shapes with values cited from AWS
  public documentation; the catalog structure admits other clouds later.
- zstd is the only compression codec modeled (per the product vision);
  its CPU multiplier and compression ratio come from cited benchmarks.
- Page-cache RAM = profile RAM minus a documented fixed overhead
  (broker heap + OS), stated as an assumption in the formula's metadata.
- Saturation threshold for status purposes is a named constant (e.g. 0.95)
  in the centralized config, per the repo's parameter-centralization rule.
- Producer backlog on admission control (when the cluster can't absorb
  offered load) reuses the 008 queue semantics — unbounded, no loss model.
- The FormulaDescriptor shape defined here is the contract feature 010
  renders; 010 develops against a static fixture of descriptors until 009
  merges, so the two features can proceed in parallel from day one.
- Exact formula expressions, multiplier values, and their citations are
  research deliverables of this feature's plan phase (`/speckit-plan`
  research.md), not invented in this spec.
