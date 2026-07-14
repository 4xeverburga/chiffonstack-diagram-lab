# Data Model: Node-Model Registry (Phase 1)

Entities are engine-internal TypeScript shapes in `sugar/src/registry/`. Types
below are illustrative of the contract, not final signatures (tasks refine).

## NodeModel

The self-contained description of one node type. Owns everything about its
behavior; the engine holds only a `Map<kind, NodeModel>` and drives these hooks.

| Field | Kind | Purpose |
|-------|------|---------|
| `id` | `string` | Registry key (the node "kind" the engine dispatches on). Unique across the registry (FR-009). |
| `label` | `string` | Human name for summaries/UI. |
| `paramSchema` | `ParamSchema` | Declared configurable inputs (validation + future config panel). |
| `validateConfig(config)` | `(unknown) => Result` | Rejects an invalid configuration with a specific message (FR-010); never runs a node with an invalid config. |
| `initialState(config)` | `(Config) => State` | The node's starting cross-window state (D2). |
| `reconcileState(prev, config, simTimeMs)` | fn | Clamp/restore state on graph or config change (generalizes `reclampReplicaRuntimes`). |
| `acceptCapacityRPS(config, effectiveState)` | `=> number` | **Pure.** Accept-capacity advertised to upstream nodes for backpressure (R1). May be `+∞` (unbounded, e.g. client_pool/external_api). |
| `computeWindow(ctx)` | `(WindowCtx) => WindowResult` | This window's metrics + next state + outgoing edge distribution (R1). |
| `formulaDescriptors` | `FormulaDescriptor[]` | Sourced formula metadata (Constitution II); conformance asserts each has a citation. |

**Validation rules (from requirements):**
- Registration fails if two models share an `id` (FR-009).
- Registration fails if a required hook/metadata is missing (edge case:
  incomplete contract must fail loudly, not at runtime).
- `computeWindow` must be a pure function of `ctx` (determinism; conformance R4).

## Registry

The curated collection the engine consults.

| Field | Kind | Purpose |
|-------|------|---------|
| `byKind` | `Map<string, NodeModel>` | O(1) resolution per node during propagation. |
| assembly | static import list in `registry/index.ts` | The **single place** built-in types are enumerated; no runtime/plugin loading (FR-013). |
| `resolve(sim)` | `(NodeSim) => NodeModel \| undefined` | Maps a diagram node's `kind`/`profile` to its model (R6). `undefined` → unknown kind → degrade to visual node (FR-007). |

## ParamSchema

A model's declared configurable inputs, expressed as **data** (FR-015), used to
validate configs now and to drive the config panel in a later feature (D3).

| Concept | Purpose |
|---------|---------|
| parameter entry | name, type (bounded number / enum / …), allowed range, unit. |
| mode grouping | conditional parameter sets keyed by a discriminant (e.g. `configMode: 'manual' \| 'calculated'`) — mirrors today's saturating-host dual mode (ports.ts:38-78). |

Expressiveness is scoped to today's needs: bounded numeric inputs, enumerated
choices, mode-dependent groups (spec Assumptions). No richer schema features
unless a reference model needs one.

## NodeState (per-node, model-owned)

The cross-window information a model carries, stored opaquely by the engine in
`stateByNode: Map<string, unknown>` (D2, R2). Concrete built-in states:

| Model | State today | Becomes |
|-------|-------------|---------|
| `queue` | `queueBacklogGB: number` | model-owned backlog state |
| `saturatingHost` | `ReplicaRuntime` (boot queue, nominal/effective counts) | model-owned replica state |
| `client_pool`, `external_api` | none | `initialState` returns empty/void |

State transitions are pure (prevState, config, resolved inflow, simTimeMs) →
nextState. No wall-clock, no unseeded randomness.

## WindowCtx / WindowResult (computeWindow I/O)

- **WindowCtx** (in): `incomingRPS`, per-outgoing-edge downstream
  accept-capacities, `windowSizeMs`, `simTimeMs`, `prevState`, `config`, and the
  edge configs needed to split outflow (payload sizes, traffic shares).
- **WindowResult** (out): `metrics` (throughput, latency, saturation, status,
  backlog, replica count as applicable — the existing `NodeMetrics` shape),
  `nextState`, and `edgeDistribution` (outgoing RPS per edge).

The engine's propagation loop assembles `WindowCtx` from topological-order
context and writes `edgeDistribution` into `edgeOutputRPS` — exactly today's
flow, now model-driven.

## ConformanceCheck

An automated property evaluated against every registered model (D5, R4):
determinism, finite/no-NaN output, flow conservation, sourced formulas, schema
round-trip. Runs in CI via Vitest; a failure names the property and model
(FR-012) and blocks merge.

## Interchange Schema Version

`DIAGRAM_SCHEMA_VERSION` (sugar `config.ts`, barrel-exported) stays the single
source of truth and **does not bump** for this feature — the serialized
`kind`/`profile` shape is unchanged; the registry is an internal resolution
(R6). Parsers still accept `≤ current` and degrade unknown kinds (FR-007).

## Relationships

```text
Registry 1──* NodeModel 1──1 ParamSchema
                    │
                    ├──1 initialState ─→ NodeState (per node, in stateByNode)
                    ├──* FormulaDescriptor (sourced)
                    └── drives → computeWindow(WindowCtx) → WindowResult
Engine propagation loop ──uses──> Registry.resolve(sim) ──> NodeModel hooks
ConformanceCheck ──iterates──> Registry (all NodeModels)
```
