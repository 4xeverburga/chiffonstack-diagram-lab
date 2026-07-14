# Research: Node-Model Registry (Phase 0)

Grounded in the actual `sugar` engine on `main` (`src/simulation.ts`,
`flowPropagation.ts`, `hostModel.ts`, `queueModel.ts`, `autoscaler.ts`,
`formulaCatalog.ts`, `ports.ts`, `diagramInput.ts`, `summary.ts`,
`components.ts`, `topology.ts`).

## R1 — The contract shape: capacity ≠ compute ≠ reconcile (the crux)

**Decision.** A `NodeModel` is **not** a single `computeWindow(incoming) →
outgoing`. It exposes three separated hooks plus declarative metadata:

1. `acceptCapacityRPS(config, effectiveState) → number` — pure, side-effect
   free. Read by **upstream** nodes during propagation to size backpressure.
2. `computeWindow(ctx) → { metrics, nextState, edgeDistribution }` — given the
   resolved `incomingRPS`, per-outgoing-edge downstream accept-capacities, the
   window size, `simTimeMs`, and the node's prior state, produce this window's
   metrics, the node's next cross-window state, and how outflow splits across
   outgoing edges.
3. `reconcileState(prevState, config, simTimeMs) → state` — clamp/restore state
   when the graph or config changes between windows (replaces
   `reclampReplicaRuntimes`).

Plus declarative metadata: `paramSchema`, `validateConfig`, `initialState`,
`formulaDescriptors`.

**Rationale.** `propagateWindow` (flowPropagation.ts:85) walks
`graph.topologicalOrder` and each node depends on **both** directions:
- **forward flow** — `incomingRPS` summed from upstream `edgeOutputRPS`
  (computed earlier in topo order);
- **backward backpressure** — a queue's outflow is bounded by its downstream
  hosts' `hostAcceptCapacityRPS(targetSim, effectiveReplicas)`
  (flowPropagation.ts:140-144); a saturating host's effective replica count is
  resolved *up front* (flowPropagation.ts:100-115) precisely so a queue
  processed before it in topo order can already see its accept-capacity.

A naive per-node `computeWindow(incoming)` cannot express this — the capacity a
node advertises to upstream must be queryable **independently** of computing the
node's own window. Splitting `acceptCapacityRPS` out is what preserves the exact
current behavior. `client_pool`/`external_api` return `+∞` accept-capacity
today (flowPropagation.ts:73-74); that becomes each model's own
`acceptCapacityRPS`.

**Alternatives considered.**
- *Single computeWindow with a downstream-capacity callback argument.* Rejected:
  hides the capacity query inside compute, so the up-front effective-replica
  resolution (needed for topo-order correctness) can't be expressed cleanly.
- *Two-pass (all capacities, then all windows).* This is effectively what the
  engine already does (drainedRuntime/effective up front, then the topo loop);
  the three-hook contract names those passes rather than inventing a new one.

## R2 — Generalizing cross-window state (D2)

**Decision.** Replace the two hard-coded maps in `createSimulation`
(`queueBacklogGB`, `replicaRuntimeByNode`, simulation.ts:36-43) with a single
`stateByNode: Map<string, unknown>` where each node's value is **owned and
typed by its model**. The model provides `initialState(config)` and
`reconcileState(...)`; the engine treats the value opaquely (stores, passes to
`computeWindow`, swaps in the returned `nextState`). The propagation output's
`nextQueueBacklogGB`/`nextReplicaRuntimeByNode` collapse into a single
`nextStateByNode`.

**Rationale.** Today `simulation.ts` knows *what* state each profile carries
(backlog for queues, replica runtime for saturating hosts) — the exact coupling
the registry removes. Model-owned state is the D2 requirement (FR-006). The
reconcile hook generalizes `reclampReplicaRuntimes` (simulation.ts:65-79) and
the queue-backlog init on graph swap (simulation.ts:160).

**Determinism guard.** State transitions stay pure functions of
(prevState, config, resolved inflow, simTimeMs) — no wall-clock, no
`Math.random` outside the seeded `mulberry32`. The conformance kit asserts this
(R4).

## R3 — Registry assembly, conflict detection, no runtime code (D4)

**Decision.** `registry/index.ts` builds a `Map<kind, NodeModel>` from a
**static import list** of the built-in models — the single place node types are
enumerated (replaces the scattered profile-string lists). Assembly throws on a
duplicate kind (FR-009). Node "kind" becomes the registry key; the existing
`sim.kind` ('host'|'queue') plus `profile` collapse into one registry key space
(see R6 for the migration of the host/profile two-level shape).

The registry is assembled at **module load from in-repo imports only**. There is
**no** code path that reads a model implementation from a diagram file or any
input (FR-013). Diagrams reference a model by its **string kind**; an unknown
kind degrades to a plain visual node (FR-007), it never loads code.

**Rationale.** Curated in-repo distribution is the D4 decision; runtime plugin
code is an XSS vector given files load from anywhere. A declarative
(non-executable) formula DSL is the possible future middle layer — explicitly
out of scope (spec Out of Scope).

## R4 — Conformance kit (D5)

**Decision.** A Vitest suite iterates `registry` and asserts, per model:
- **Determinism** — two runs with the same seed on a fixture topology produce
  identical metrics/state.
- **No-NaN / finite** — `computeWindow` never emits NaN/Infinity in metrics
  (Infinity is allowed only where the engine already uses it as "unbounded
  capacity", asserted explicitly).
- **Flow conservation** — outflow ≤ inflow + drained-backlog within ε; a model
  cannot invent traffic (queues may store/release; hosts may shed/collapse, but
  accounted).
- **Sourced formulas** — `validateFormulaDescriptorsHaveSources(model.formulaDescriptors)`
  passes (reuses formulaCatalog.ts:286).
- **Schema round-trip** — a config built from `paramSchema` defaults
  serializes → `diagramInput.ts` parses → equals original (guards FR-008).

Plus a **test-only fixture model** (e.g. a trivial "passthrough" or "cache")
registered *inside the test* to prove SC-001/SC-003: adding a model touches only
its own entry and requires **zero** edits to the propagation loop. This fixture
is never exported from the package (Constitution I — no user-facing new type).

**Rationale.** Turns Principles II & VI into an executable gate (FR-011/FR-012).
CI already runs `npm test`; the kit rides that gate. The fixture is how we
verify extensibility without shipping a new node type.

## R5 — Behavior preservation & determinism proof (US2, SC-002)

**Decision.** Before refactoring, capture golden `sugar run --json` summaries
(fixed seed) for all four `sugar/examples/` topologies + the diagram-lab
bundled demo. Assert byte-identical summaries after each migration step. Migrate
**one model at a time** behind the registry while the others keep the legacy
path, so a determinism break is bisected to a single model. The refactor is
"done" only when no profile-string dispatch remains in the stepping loop
(SC-003) and all goldens match.

**Rationale.** This is the P1 guardrail (US2). The engine's own tests already
pin operating-point values; goldens add end-to-end determinism coverage across
the migration.

## R6 — Migrating the host/profile two-level shape

**Decision.** Today node behavior is two-level: `sim.kind` ∈ {host, queue} and,
for hosts, `sim.profile` ∈ {client_pool, external_api, transactional_api,
worker_consumer, database_server} (ports.ts:35-85). The registry keys on a flat
**model id**. Map each existing (kind, profile) pair to a model id:
- `queue` → `queue` model.
- `host/client_pool` → `client_pool` model; `host/external_api` →
  `external_api` model.
- `host/{transactional_api,worker_consumer,database_server}` → **one**
  `saturatingHost` model (they already share the same param shape and physics —
  ports.ts:38-78 — differing only by label; the model reads the specific profile
  as config, keeping export/schema unchanged).

**Interchange compatibility (hard constraint).** The **serialized JSON shape is
unchanged** — files still carry `sim.kind`/`sim.profile`. The registry mapping
is an **internal** resolution (`resolveModelId(sim)`); `DIAGRAM_SCHEMA_VERSION`
does **not** bump. `diagramInput.ts`'s tolerant parse and the app's
`exportDiagram.ts` whitelist are untouched (FR-007/FR-008). This keeps the
registry a pure internal refactor from the file's point of view.

**Rationale.** Backward compat (Constitution III) and determinism forbid
changing the on-disk shape. The registry improves *internal* dispatch only.

## R7 — Cross-repo governance (process, not code)

**Finding.** The speckit constitution (`.specify/memory/constitution.md`,
v3.4.0) and this spec live in **diagram-lab**, but the implementation lands in
**`sugar`**. The constitution text still references `src/engine/config.ts`
(pre-extraction geography) and `sugar` has no speckit scaffolding or its own
constitution copy.

**Decision (recommendation for the maintainer, out of this feature's code
scope).** Treat the diagram-lab constitution as the governing document for the
shared model (assessment D6: "the sourced-formula constitution principle as the
contribution bar stands"). Two lightweight follow-ups, **not blocking** this
feature: (a) a PATCH constitution amendment updating the stale `src/engine/`
references post-extraction; (b) a pointer in `sugar` (e.g. CONTRIBUTING or
README) to the governing principles, deferred with D6. Flagged here so the
tasks/plan don't silently assume `sugar` inherits speckit gates.

## Resolved unknowns

- Contract shape → R1 (three hooks + metadata, not one computeWindow).
- Cross-window state generalization → R2 (opaque `stateByNode`, model-owned).
- Distribution/security → R3 (static in-repo assembly, string-keyed, no runtime code).
- Conformance properties → R4.
- Determinism preservation strategy → R5 (goldens + one-model-at-a-time).
- Schema/host-profile migration → R6 (internal model-id mapping, no schema bump).
- Governance wrinkle → R7 (documented; non-blocking follow-ups).

No open NEEDS CLARIFICATION remain.
