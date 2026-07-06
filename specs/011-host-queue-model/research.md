# Research: Generalized Host/Queue Simulation Model (011)

All Technical Context unknowns resolved. Decisions numbered for citation from plan/tasks.

## D1 — Windowed deterministic propagation, not per-event host simulation

**Decision**: Compute host/queue/edge metrics once per metrics window as a deterministic flow pass (rates in → rates/telemetry out), layered on the existing tick/window loop. The Poisson event queue survives only to jitter client-pool arrivals into a windowed rate; hosts and queues have no per-event behavior.

**Rationale**: Every formula in the spec (ρ, ρ/(1−ρ) latency, share splits, Little's law, backlog integration) is a function of per-window rates. Per-event processing would add cost proportional to throughput (violating SC-006's 10k req/s bar) for zero observable difference after windowing. This is exactly the pattern `computeKafkaWindowMetrics` proved out in 009 — generalized to the whole graph.

**Alternatives considered**: (a) Full DES with per-request latency sampling — rejected: O(throughput) cost, no user-visible benefit at 200 ms windows. (b) Pure closed-form with no event queue at all — rejected for v1: keeping the Poisson source preserves the existing generator smoothing behavior and the TrafficSourcePort seam for future bursty/trace sources.

## D2 — Latency curve: L(ρ) = base × (1 + ρ/(1−ρ)), ρ clamped

**Decision**: `latencyMs = baseLatencyMs * (1 + rho / (1 - rho))` with `rho = min(saturationRatio, RHO_CLAMP)` where `RHO_CLAMP` (e.g. 0.99) lives in `config.ts`. Applied continuously from ρ=0 — no threshold gate. Equivalent to M/M/1 residence-time scaling W = S/(1−ρ).

**Rationale**: Clarification session requires a smooth curve with no discontinuity, exploding near saturation (SC-002: ≥5× baseline at ρ=0.95; this gives 20×). Scaling by base latency (not a fixed 2 ms) makes the explosion proportional to the service's own cost, fixing the "tame hockey stick" bug in the original sketch.

**Alternatives considered**: (a) Original sketch's `(ρ/(1−ρ)) × 2ms` above ρ=0.85 — rejected: discontinuous at the gate and caps at ~198 ms regardless of service cost. (b) M/M/c Erlang-C — rejected: more parameters (queue discipline assumptions) for marginal fidelity; violates lean-parameter principle in spirit.

## D3 — Calculated-mode capacity and base latency

**Decision**:
- `capacityRPS = maxWorkerThreads / (cpuProcessingTimeMs / 1000)` for weight-1.0 traffic.
- `rho = (incomingRPS × weightedAvgMultiplier × cpuProcessingTimeMs / 1000) / maxWorkerThreads`, where `weightedAvgMultiplier` is the traffic-weighted mean of inbound edges' `targetComputeWeightMultiplier`.
- `baseLatencyMs = cpuProcessingTimeMs + trafficWeightedAvg(outboundEdges.pathIoLatencyMs)` (clarification #3).
- Manual mode: `rho = incomingRPS / manualSaturationRPS`; `baseLatencyMs = manualBaselineLatencyMs`.

**Rationale**: Matches the user's sketch formulas exactly; SC-003 (manual/calculated agreement within 1%) falls out by construction when inputs are equivalent. The traffic-weighted average reuses the `weightedAveragePayloadBytes` pattern from the retired Kafka model.

**Alternatives considered**: Per-edge capacity partitioning (model each inbound edge as its own queue) — rejected: implies per-edge latency outputs and more parameters; single-server-pool abstraction matches the sketch.

## D4 — Queue outflow derived from downstream hosts

**Decision**: Per window, a queue's desired outflow on each outbound edge is what the target host can still accept: `acceptableRPS = targetCapacityRPS_remaining` split per the edge's share of the target's inbound traffic, converted to MB/s via that edge's `averagePayloadSizeKB`. Actual outflow = `min(desired, inflow + backlog/windowSec)`. Backlog integrates the difference, floored at 0 (unbounded above — no retention parameter).

**Rationale**: Clarification #2 — queues carry zero config; the only place drain capacity can come from is the consumers. Mirrors the retired Kafka `availableMBps` computation, minus retention/disk-cliff ceilings.

**Alternatives considered**: Queue `drainRate` parameter — rejected by clarification (violates zero-config queues). Unlimited outflow — rejected: backlog would never form, killing User Story 3.

## D5 — Propagation order: existing DFS cycle detection + topological sort

**Decision**: `buildTopologyGraph` keeps its shape; add a Kahn topological ordering over the simulated subgraph computed at `loadTopology` time. Per window, propagate in that order: client pools emit `requestRatePerSec` (jittered by the Poisson source's windowed count), each edge takes `sourceOutputRPS × normalizedShare`, each host computes ρ/latency/shedding, each queue integrates backlog. Cycles already throw `CycleError` before ordering is attempted.

**Rationale**: Fixes the sketch's propagation bug (client pools have no *incoming* RPS — sources emit *generated* RPS). Ordering is computed once per topology load, O(V+E) per window thereafter.

**Alternatives considered**: Fixed-point iteration to support cycles — rejected: cycles are already a spec-level rejection (FR-009), and iteration would reopen the "simulation hangs" edge case 008 closed.

## D6 — manualMaxRPS: hard forward-clamp, shed the rest

**Decision**: A manual-mode host's forwarded output is `min(processableRPS, manualMaxRPS)`; offered load beyond it is shed (recorded in node telemetry as `shedRPS` for display, derived — not a new input parameter). Saturation display uses the unclamped offered load. No error/retry/crash modeling.

**Rationale**: Clarification #1 (maxRPS = collapse cap before errors). Exposing `shedRPS` as *telemetry* keeps FR-020 intact (closed set governs *inputs*, not outputs) while making shedding visible.

**Alternatives considered**: Error-rate curve between saturationRPS and maxRPS — rejected: out of scope (no error modeling in v1).

## D7 — Retired roles degrade to visual-only nodes on import

**Decision**: `exportDiagram`/import keeps parsing old JSON; nodes whose `data.sim.role` is a retired role get their `sim` payload dropped (node becomes a plain visual node) with a one-time console/UI notice. No auto-conversion.

**Rationale**: Spec assumption (pre-pivot diagrams are decorative; no persistence guarantees yet). Cheaper and safer than guessing role→profile mappings.

**Alternatives considered**: Auto-migrate producer→client_pool etc. — rejected: silent semantic changes to user models contradict the traceability ethos.

## D8 — Formula sources

**Decision**: Cite structured sources on each descriptor:
- Saturation ratio & latency curve: M/M/1 utilization and residence time — Kleinrock, *Queueing Systems Vol. 1* (1975); supplemented by a practitioner reference (e.g. Gunther's Universal Scalability Law discussion or Harchol-Balter, *Performance Modeling and Design of Computer Systems*, 2013) for the "hockey stick" framing.
- Active connections: Little's law — Little (1961), *A Proof for the Queuing Formula L = λW*.
- Capacity from threads × service time: operational analysis (utilization law) — Denning & Buzen (1978), *The Operational Analysis of Queueing Network Models*.
- Backlog integration & RPS↔MB/s conversion: arithmetic definitions; cite the product's own data-model doc as the source per the existing convention for definitional formulas.

**Rationale**: Constitution II requires a citation per formula; these are the canonical texts. Exact URLs resolved at implementation time and validated by `validateFormulaDescriptorsHaveSources`.

**Alternatives considered**: Vendor blog posts — rejected where a primary text exists.
