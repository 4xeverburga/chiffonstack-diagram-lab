# Feature Specification: Simulation Engine Walking Skeleton

**Feature Branch**: `008-simulation-engine-skeleton`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "Simulation engine walking skeleton (feature 008). Pivot foundation for SUGAR: remove the legacy export pipeline, move canvas state to a serializable global store, run a discrete-event simulation core off the main thread behind explicit ports, and deliver a minimal end-to-end flow (load generator → placeholder processing nodes → sink) with aggregated metrics, bounded flow animation, start/pause/reset controls, and per-node metrics in the Inspector. Kafka formulas, hardware profiles, and formula/source display are out of scope (specs 009/010)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a simulation on a simple topology (Priority: P1)

An engineer places a load-generator node, connects it to a processing node, connects that to a sink node, sets the generator's traffic rate and the processing node's service rate, and presses Start. The edges animate proportionally to the traffic flowing through them, and the topology visibly congests (queue grows) when the generator's rate exceeds the processing node's service rate.

**Why this priority**: This is the walking skeleton — the single end-to-end slice that proves the product concept (model → simulate → watch it breathe). Every later feature (Kafka model, hardware profiles) builds on this loop existing.

**Independent Test**: Build the three-node topology, set generator rate above service rate, press Start, and observe edge animation plus a growing queue metric on the processing node; set rate below service rate and observe the queue drain.

**Acceptance Scenarios**:

1. **Given** a topology of generator → processor → sink with generator rate 100 req/s and processor service rate 200 req/s, **When** the user presses Start, **Then** edges animate, the processor's reported throughput approaches 100 req/s, and its queue depth stays near zero.
2. **Given** the same topology with generator rate 300 req/s and processor service rate 200 req/s, **When** the simulation runs, **Then** the processor's throughput plateaus near 200 req/s and its queue depth grows over time.
3. **Given** a running simulation, **When** the user presses Pause, **Then** metrics and edge animation freeze at their last values; **When** the user presses Reset, **Then** all metrics return to zero and animation stops.
4. **Given** a running simulation, **When** the user pans, zooms, or drags nodes, **Then** the canvas remains responsive with no visible stutter.

---

### User Story 2 - Inspect live metrics for a selected node (Priority: P2)

While a simulation runs, the engineer clicks a node and sees its live metrics — current throughput and queue depth — in the right-sidebar Inspector, updating continuously. Placeholder processing nodes are visibly labeled as placeholders (no real technology model behind them yet).

**Why this priority**: Numbers, not just animation, are what the target user trusts. This is also the surface the formula/source display (spec 009/010) will extend.

**Independent Test**: Run the P1 topology, select the processing node, and verify the Inspector shows throughput and queue depth values consistent with the configured rates; verify the placeholder label is visible.

**Acceptance Scenarios**:

1. **Given** a running simulation, **When** the user selects the processing node, **Then** the Inspector shows its current throughput and queue depth, refreshing at a steady cadence.
2. **Given** a selected placeholder processing node, **When** the user views the Inspector, **Then** the node is explicitly identified as a placeholder model with a fixed service rate.
3. **Given** a paused simulation, **When** the user selects any node, **Then** the Inspector shows the frozen last-known metrics.

---

### User Story 3 - Configure simulation nodes and persist the topology (Priority: P3)

The engineer edits node parameters (generator rate, processor service rate) in the Inspector, saves the topology as JSON, reloads the app, pastes the JSON back, and gets the same topology with the same parameters, ready to simulate again. Simulation nodes look like ordinary diagram nodes — a label plus an optional image (e.g. a node named "Kafka Cluster" with a Kafka logo); their simulation role is data, not a different visual.

**Why this priority**: Round-trippable topology JSON is a constitutional requirement and the base for sharing/versioning models, but the feature is demonstrable without it.

**Independent Test**: Configure rates, export the topology JSON, re-import it in a fresh session, and confirm node kinds, connections, and configured rates survived; confirm live metrics did not.

**Acceptance Scenarios**:

1. **Given** a topology with configured rates, **When** the user exports and re-imports the JSON, **Then** node kinds, labels, images, positions, connections, and configured parameters are identical.
2. **Given** a re-imported topology, **When** the user inspects it before starting a simulation, **Then** all live metrics are at their reset state (transient simulation state is not persisted).
3. **Given** a topology JSON produced before this feature (a legacy diagram), **When** the user imports it, **Then** it loads without error as a non-simulating diagram whose nodes can be assigned simulation roles.

---

### Edge Cases

- Topology with no load-generator node: Start is unavailable or a clear message explains nothing will flow.
- Disconnected nodes or islands: unconnected nodes simply receive no traffic; simulation still runs for connected paths.
- Cycles in the topology: the simulation must not hang or overflow; either traffic circulates with bounded computation or cycles are rejected with a clear message at Start.
- Extreme rates (e.g. 1,000,000 req/s): edge animation stays within its bounded visual range and the UI stays responsive; metrics display large values legibly.
- Rate set to zero: no traffic flows; queues drain at service rate.
- Editing a node's parameters while the simulation runs: either applied live or rejected with clear feedback — but never silently ignored.
- Deleting a node or edge while the simulation runs: the simulation stops or restructures without crashing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to assign simulation roles to nodes: load generator (configurable average traffic rate, stochastically varied), placeholder processor (configurable fixed service rate, unbounded FIFO queue), and sink (absorbs all traffic).
- **FR-002**: Simulation nodes MUST use the existing node visuals (label + optional image); the simulation role and its configuration are node data, not a new visual component. Placeholder processors MUST be visibly labeled as placeholders in the Inspector.
- **FR-003**: Users MUST be able to start, pause, and reset the simulation from a persistent control surface on the canvas.
- **FR-004**: While running, edge animation speed/density MUST reflect the throughput crossing that edge, using the existing edge flow animation, with all animated values bounded so any throughput from zero to arbitrarily large maps to a stable visual range. No per-request visual elements (particles) are rendered.
- **FR-005**: The simulation MUST compute per-node throughput and queue depth, and queues MUST grow when a node's input rate exceeds its service rate and drain when it is below.
- **FR-006**: The Inspector MUST show the selected node's simulation configuration (editable) and its live metrics (read-only), updating at a steady cadence while the simulation runs.
- **FR-007**: The UI MUST receive simulation results as fixed-interval aggregated snapshots; individual simulated events MUST NOT drive UI updates, and canvas interaction MUST stay responsive while the simulation runs.
- **FR-008**: The simulation logic MUST be exercisable and unit-testable without any UI present (pure logic behind explicit input/output boundaries), per constitution Principles IV and VI.
- **FR-009**: Topology JSON MUST round-trip: node kinds, labels, images, positions, connections, and simulation configuration survive export/import; transient live metrics do not. Pre-pivot diagram JSON MUST still import (backward compatibility per Principle III).
- **FR-010**: The legacy export pipeline (animated SVG export, component-code export, agent bundle, and its toolbar) MUST be removed from the product; the only remaining export is topology JSON.

### Key Entities

- **Topology**: the user's model — nodes, edges, and each node's simulation configuration. Serializes to self-contained JSON.
- **Simulation role**: a node's behavior in the engine — generator, placeholder processor, or sink — plus its configuration (rates).
- **Metric window**: a fixed-interval aggregated snapshot of per-node/per-edge measurements (throughput, queue depth) — the only data the UI consumes from the engine.
- **Simulation run**: the lifecycle (idle → running → paused → reset) governing when metrics update and animation plays.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can build the generator → processor → sink topology and see it congest (growing queue) in under 5 minutes without documentation.
- **SC-002**: With simulated traffic at 10,000 req/s or more, canvas interactions (pan, zoom, drag) remain fluid — no interaction is delayed perceptibly (≥ ~50 ms hitches) by the running simulation.
- **SC-003**: For the P1 scenarios, reported steady-state throughput is within 5% of the analytically expected value (min of input rate and service rate).
- **SC-004**: 100% of topology JSON exports re-import to an identical topology (automated round-trip check), including at least one pre-pivot legacy diagram fixture.
- **SC-005**: All simulation logic (event scheduling, queueing, aggregation, animation mapping) is covered by unit tests that run without a browser UI.

## Assumptions

- Single simulation run at a time; no scenario comparison or run history in this feature.
- Generator traffic uses a Poisson arrival process as the default stochastic model; the user sets only the average rate.
- Placeholder processors use one fixed service rate and an unbounded FIFO queue — no loss, no timeout, no backpressure semantics yet (those arrive with real models in spec 009).
- Edge unit conversion (RPS ↔ MB/s) is deferred to spec 009; in this feature all traffic is in requests/second.
- Simulated time runs in real time (1×); time-scaling controls are a later feature.
- Metric window cadence is implementation-chosen within 100–500 ms; the requirement is only that updates look continuous and are not per-event.
- Existing diagram-editing capabilities (node creation, images, alignment, edge styling) remain functional except the removed export pipeline.
- The pivot's state-management migration (per constitution: Zustand, simulation payloads in node/edge `data`) happens inside this feature but is an implementation concern detailed in the plan.
