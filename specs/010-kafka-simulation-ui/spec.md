# Feature Specification: Kafka Simulation UI

**Feature Branch**: `010-kafka-simulation-ui`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "Kafka simulation UI (feature 010, UI-side only — engine model is feature 009, developed in parallel against the shared FormulaDescriptor contract). Inspector configuration for Kafka/producer/consumer roles, live Kafka metrics display with saturation meters and status badge, the formula & sources panel at the bottom of the right sidebar (constitution Principle II surface), canvas status feedback using existing design tokens, and dual-unit edge metrics. Develops against a static fixture until 009 merges. Out of scope: engine formulas, new node visual components, charts/history, other tech models."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure a Kafka topology from the Inspector (Priority: P1)

An engineer selects a node, assigns it the Kafka role, and configures it
entirely from the right-sidebar Inspector: hardware profile from a catalog
picker, partition count, replication factor, TLS toggle, compression
selector, retention. Producer nodes get rate and average payload size;
consumer nodes get capacity. Invalid values are rejected inline with a clear
message. The node on the canvas still looks like an ordinary node — its
label and optional image (e.g. "Kafka Cluster" with a Kafka logo) are the
only visuals.

**Why this priority**: configuration is the entry point to everything else;
without it no Kafka simulation can be expressed.

**Independent Test**: assign each of the three roles, fill every field,
enter invalid values (zero payload, negative rate, blank partition count)
and verify inline rejection; export/import the topology JSON and verify the
configuration survives.

**Acceptance Scenarios**:

1. **Given** a selected node with the Kafka role, **When** the user opens
   the Inspector, **Then** all Kafka fields are visible and editable, with
   the hardware profile picker showing each profile's key specs (vCPU,
   RAM, network, disk).
2. **Given** a producer configuration with payload size zero or empty,
   **When** the user attempts to apply it, **Then** the value is rejected
   inline with a message explaining why (unit conversion needs it) and the
   previous valid value is retained.
3. **Given** a fully configured topology, **When** it is exported and
   re-imported, **Then** every configured value reappears in the Inspector.
4. **Given** any simulation node on the canvas, **When** compared with a
   plain diagram node, **Then** its visual anatomy is identical (label +
   optional image) apart from the status treatment of User Story 3.

---

### User Story 2 - Read the cluster's health at a glance (Priority: P1)

While a simulation runs, the engineer selects a Kafka node and reads its
live state in the Inspector: ingress/egress throughput, three saturation
meters (network, CPU, disk), consumer lag, page cache hit ratio, and a
status badge (healthy / saturated / degraded). The binding constraint —
the wall currently limiting throughput — is visually distinguished.

**Why this priority**: the metrics display is how the target user answers
"which wall am I hitting?" — the product's core question. Ties P1 with
configuration because both are needed for the minimal loop.

**Independent Test**: with fixture data (pre-009) or a live run (post-009),
drive each of the three metric regimes and verify the meters, badge, and
binding-constraint highlight update accordingly at the metric-window
cadence.

**Acceptance Scenarios**:

1. **Given** a running simulation with a healthy Kafka node selected,
   **When** the Inspector renders, **Then** all meters show their ratios,
   the badge reads healthy, and values refresh continuously without
   flicker.
2. **Given** a node whose network saturation reaches its wall, **When**
   the next metric windows arrive, **Then** the network meter is visibly
   at its limit, marked as the binding constraint, and the badge reads
   saturated.
3. **Given** a node in the disk-cliff regime, **When** the Inspector
   renders, **Then** page cache hit ratio visibly drops, the badge reads
   degraded, and the disk constraint is marked binding.
4. **Given** a paused simulation, **When** any node is selected, **Then**
   the last-known metrics render frozen (008 behavior preserved).

---

### User Story 3 - See system stress on the canvas itself (Priority: P2)

Without selecting anything, the engineer sees stress on the canvas: nodes
in saturated or degraded status get a subtle status treatment (border/badge
built from the existing design tokens — not a new node component), and edge
metrics display in their native units on each side of a unit-converting
connection (req/s from the producer, MB/s into the Kafka node).

**Why this priority**: the canvas-as-dashboard is SUGAR's product promise,
but it builds on the P1 config/metrics plumbing.

**Independent Test**: run a topology into saturation and verify the
affected node's status treatment appears/clears as status changes; hover
or inspect a converting edge and verify both units are shown with
consistent values (MB/s = req/s × payload).

**Acceptance Scenarios**:

1. **Given** a running simulation where one node saturates, **When** the
   user views the canvas, **Then** that node (and only that node) carries
   the saturated treatment, which clears when load drops.
2. **Given** a producer→Kafka edge with 1,000 req/s × 1 KB payload,
   **When** its metrics are viewed, **Then** both 1,000 req/s and
   ≈1 MB/s are presented and mutually consistent.
3. **Given** a degraded node, **When** the user views the canvas,
   **Then** the degraded treatment is visually distinct from saturated,
   and both remain legible with the user's design tokens.

---

### User Story 4 - Audit the formulas behind the numbers (Priority: P2)

With a simulation node selected, the bottom of the right sidebar shows the
formula & sources panel: every formula currently governing that node, its
human-readable expression, its current input values, which constraint is
binding right now, and each formula's source citations as clickable links.
The panel carries honest framing: results are directionally correct for
comparing scenarios, not guarantees.

**Why this priority**: the constitutional Principle II surface and the
product's credibility argument; P2 because it renders data whose producer
(009) can land after the panel exists.

**Independent Test**: select nodes in different regimes (fixture or live)
and verify the panel lists the active formulas with non-empty expressions
and ≥1 source link each, highlights the binding one, updates when the
regime changes, and displays the directional-accuracy disclaimer.

**Acceptance Scenarios**:

1. **Given** a selected Kafka node, **When** the panel renders, **Then**
   each active formula shows name, expression, current inputs, and its
   sources as links that open in a new tab.
2. **Given** the node crosses from healthy into the disk-cliff regime,
   **When** the panel refreshes, **Then** the binding-constraint highlight
   moves to the page-cache/disk formula.
3. **Given** any state of the panel, **When** the user reads it, **Then**
   the directionally-correct disclaimer is present and no wording implies
   guaranteed real-world performance.
4. **Given** a selected node with no simulation role, **When** the panel
   area renders, **Then** it explains that no formulas apply rather than
   rendering empty.

---

### Edge Cases

- 008-era placeholder processor selected: Inspector keeps its existing
  minimal config; formula panel states it is a placeholder with no real
  model (Principle I labeling), not an empty formula list.
- Metrics arrive for a node the UI no longer knows (deleted mid-run):
  ignored gracefully; no crash, no ghost UI.
- Very long source titles/URLs and many formulas: panel scrolls within the
  sidebar; the sidebar never breaks the canvas layout.
- Editing configuration while running: inherits 008's auto-pause rule;
  the Inspector communicates the pause.
- Extreme metric values (lag in TB, ratios > 1): meters clamp visually but
  display the true number as text; no unbounded visual growth (Principle V
  spirit).
- Fixture mode (pre-009 integration): every UI state reachable with the
  static fixture; no UI code path requires the real engine to render.
- User's design tokens set to low-contrast values: status treatments derive
  from tokens but must remain distinguishable (e.g. shape/badge redundancy,
  not color alone — also the accessibility fallback).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Inspector MUST provide role assignment and full
  configuration UI for Kafka (hardware profile picker with per-profile
  specs, partitions, replication factor, TLS toggle, compression selector,
  retention), producer (rate, average payload size), and consumer
  (capacity) roles, alongside the existing 008 roles.
- **FR-002**: All configuration inputs MUST validate inline: invalid values
  are rejected with a human-readable reason and never silently clamped or
  ignored; the last valid value is retained.
- **FR-003**: Simulation nodes MUST keep the ordinary node anatomy (label +
  optional image); role and configuration are expressed only through the
  Inspector and the status treatment of FR-006.
- **FR-004**: The Inspector MUST render live Kafka metrics for the selected
  node: ingress/egress throughput, network/CPU/disk saturation meters,
  consumer lag, page cache hit ratio, and a status badge with exactly three
  states (healthy/saturated/degraded), refreshing at the metric-window
  cadence, frozen when paused.
- **FR-005**: The binding constraint (the resource currently limiting
  throughput) MUST be visually distinguished in the metrics display and in
  the formula panel, and the two MUST always agree.
- **FR-006**: Nodes in saturated or degraded status MUST carry a subtle
  canvas status treatment derived from existing design tokens; the two
  states MUST be mutually distinguishable, not rely on color alone, and
  clear immediately when status returns to healthy. No new node visual
  component may be introduced.
- **FR-007**: Edges that convert units MUST present their traffic in both
  native units (req/s and MB/s), mutually consistent with the configured
  payload size.
- **FR-008**: A formula & sources panel MUST occupy the bottom section of
  the right sidebar, rendering FormulaDescriptor data for the selected
  node: formula name, human-readable expression, current input values,
  binding flag, and source citations as external links. For nodes without
  formulas it MUST explain why (no role / placeholder role) instead of
  rendering empty.
- **FR-009**: The formula panel MUST include the standing disclaimer that
  simulated numbers are directionally correct for comparing scenarios, not
  guarantees (constitution Principle II wording rule).
- **FR-010**: The complete UI MUST be developable and demonstrable against
  a static fixture of KafkaNodeMetrics + FormulaDescriptor data (the shared
  contract with feature 009), with the swap to live engine data requiring
  no UI rework — fixture and live data flow through the same path.
- **FR-011**: All new UI MUST respect the existing design-token system for
  colors/typography and keep the render-discipline rules: UI updates driven
  by metric windows only, meters and treatments bounded regardless of
  metric magnitude.

### Key Entities

- **Role configuration form model**: the Inspector-side representation of
  Kafka/producer/consumer config with validation state; persists through
  the same node-data path as 008.
- **KafkaNodeMetrics (consumed)**: per-window metrics shape shared with
  009 — ingress/egress, saturation ratios, lag, cache hit ratio, status.
- **FormulaDescriptor (consumed)**: the shared auditability contract —
  id, name, expression, current inputs, binding flag, sources (title, URL,
  note). Rendered, never produced, by this feature.
- **Status treatment**: the token-derived visual state (healthy: none;
  saturated; degraded) applied to canvas nodes.
- **Metrics fixture**: static dataset exercising every regime (healthy,
  each saturation wall, disk cliff, placeholder, no-role) used until 009
  integration and kept afterwards for UI tests.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An engineer can assign and fully configure a Kafka node,
  producer, and consumer from the Inspector in under 3 minutes without
  documentation.
- **SC-002**: 100% of invalid configuration entries produce inline
  feedback naming the problem; zero are silently accepted or clamped
  (verified by a validation test matrix).
- **SC-003**: In a usability pass over the three regimes (healthy,
  saturated, disk-cliff), a viewer can identify the binding constraint
  from the Inspector within 10 seconds per regime.
- **SC-004**: Every formula shown in the panel displays ≥1 clickable
  source; the disclaimer is present in all panel states; nodes without
  formulas always show the explanatory state (no empty panel) — verified
  across the full fixture.
- **SC-005**: The entire feature demo (all four stories) runs on the
  static fixture with the engine absent, and identically on live data
  after 009 integration, with no UI code changes between the two.
- **SC-006**: Canvas interaction fluidity from 008 (SC-002 there) is
  preserved with the new status treatments and panels active.

## Assumptions

- The KafkaNodeMetrics and FormulaDescriptor shapes are defined in feature
  009's spec (Key Entities) and are the shared contract; any change to
  them during parallel development is coordinated through a small
  dedicated PR touching only the contract, per the team's working
  agreement.
- The formula panel location is fixed by user decision: bottom of the
  right sidebar, below configuration and metrics.
- Meters are simple bounded indicators; time-series charts and history are
  explicitly deferred.
- Producer/consumer Inspector sections reuse the interaction patterns
  established by 008's generator/processor config (consistency over
  novelty).
- Sources open as external links; no in-app citation viewer.
- The existing four design tokens plus current neutral styles are
  sufficient for the status treatments; if a genuinely new token were
  needed, that requires a constitution-level discussion and is out of
  scope here.
- English-only UI copy, matching the current product.
