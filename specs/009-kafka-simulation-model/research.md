# Research: Kafka Simulation Model (Feature 009)

## Decision 1: Hardware profile catalog values are source-cited static constants

- Decision: Ship an in-engine catalog for `m6i.large`, `m6i.xlarge`, `m6i.2xlarge`, `m6i.4xlarge` with vCPU, RAM, network MB/s, and modeled effective disk throughput, each carrying source metadata.
- Rationale: FR-002 and FR-009 require explicit citations and deterministic behavior. Static constants avoid runtime variability and keep tests stable.
- Alternatives considered:
  - Fetch dynamic cloud metadata at runtime: rejected due to determinism and no-backend constraint.
  - Omit citations and document in comments: rejected by Principle II and FR-009.

## Decision 2: CPU ceiling model uses explicit multiplicative overheads

- Decision: Compute CPU ingress ceiling as `baseMBpsPerVcpu * vcpu / (partitionPenalty * tlsMultiplier * compressionMultiplier)`.
- Rationale: Matches FR-006 requirement for named multipliers and allows deterministic side-by-side tests for TLS/zstd impact (SC-004).
- Alternatives considered:
  - Additive penalty model: rejected as less interpretable and harder to map to bottleneck intuition.
  - Hidden heuristic per profile: rejected due to traceability and auditability constraints.

## Decision 3: Disk Cliff modeled as threshold regime switch

- Decision: Use deterministic threshold `lagBytes > cacheCapacityBytes` where `cacheCapacityBytes = max(0, (ramGiB - overheadGiB)) * GiB`; switch consumer read ceiling from cached regime to disk-bound regime with no hysteresis.
- Rationale: FR-007 and SC-002 require abrupt, deterministic regime transition and formula clarity.
- Alternatives considered:
  - Gradual interpolation/smoothing: rejected because spec explicitly forbids linear slope behavior for cliff.
  - Hysteresis bands: rejected for this feature because FR-007 requires deterministic threshold behavior.

## Decision 4: Formula traceability is first-class payload data

- Decision: `FormulaDescriptor` contains `id`, `name`, `expression`, `inputs`, `sources[]`, and `isBinding`, and is emitted in node metrics.
- Rationale: Principle II and FR-009 require source-backed, UI-renderable formula metadata for feature 010.
- Alternatives considered:
  - Static docs-only formula reference: rejected because active inputs and binding state must be runtime data.
  - Comments in code only: rejected due to non-structured and non-port-exposed format.

## Decision 5: Backward compatibility is strict on 008 topologies

- Decision: Keep legacy role behavior intact and ensure new role/config fields are whitelist-serialized without leaking transient metrics.
- Rationale: FR-011 and SC-006 require unchanged load/sim behavior for 008-era topology JSON.
- Alternatives considered:
  - Breaking schema rev: rejected due to migration burden and out-of-scope UI migration flows.
