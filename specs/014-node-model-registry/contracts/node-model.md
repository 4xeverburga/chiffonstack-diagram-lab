# Contract: The `NodeModel` extension interface

The registry's public extension point, in `sugar/src/registry/nodeModel.ts` and
re-exported from the package barrel (`sugar/src/index.ts`). This is the surface a
future contributor implements to add a node type. Signatures are the **intended
contract**; tasks may refine names/types as long as the guarantees below hold.

```ts
// Illustrative — see data-model.md. Not final.
export interface NodeModel<Config = unknown, State = unknown> {
  /** Unique registry key = the node "kind" the engine dispatches on. */
  readonly id: string
  readonly label: string

  /** Declared configurable inputs, as data (drives validation + future panel). */
  readonly paramSchema: ParamSchema

  /** Sourced formula metadata; conformance requires ≥1 citation each. */
  readonly formulaDescriptors: readonly FormulaDescriptor[]

  /** Reject an invalid config with a specific message; never run an invalid node. */
  validateConfig(raw: unknown): { ok: true; config: Config } | { ok: false; message: string }

  /** Starting cross-window state for a node of this model. */
  initialState(config: Config): State

  /** Clamp/restore state on a graph or config change between windows. */
  reconcileState(prev: State, config: Config, simTimeMs: number): State

  /** PURE. Accept-capacity advertised upstream for backpressure. May be +Infinity. */
  acceptCapacityRPS(config: Config, state: State): number

  /** This window's metrics + next state + per-edge outgoing distribution. */
  computeWindow(ctx: WindowCtx<Config, State>): WindowResult<State>
}
```

## Guarantees the engine relies on (MUST)

1. **Determinism.** `computeWindow` and `acceptCapacityRPS` are pure functions of
   their inputs — no wall-clock, no unseeded randomness. Same inputs → identical
   outputs. *(FR-005, conformance: determinism.)*
2. **Purity of the capacity query.** `acceptCapacityRPS` has no side effects and
   does not depend on the current window's inflow — it is read *before* the node
   computes its own window, by upstream nodes. *(R1.)*
3. **Finite output.** `computeWindow` metrics contain no `NaN`; `Infinity`
   appears only as an explicit "unbounded capacity" sentinel where the engine
   already uses it. *(Conformance: no-NaN.)*
4. **Flow conservation.** Total outgoing RPS ≤ incoming RPS + backlog released
   this window, within ε. A model may store (queue) or shed/collapse (host)
   traffic, but must account for it — never invent it. *(Conformance:
   conservation.)*
5. **State ownership.** The engine stores `State` opaquely and only ever obtains
   it from `initialState` / `reconcileState` / `computeWindow.nextState`. Models
   MUST NOT reach into engine internals or other nodes' state. *(FR-006,
   Constitution IV.)*
6. **Sourced formulas.** Every entry in `formulaDescriptors` carries a source
   citation. *(Constitution II, FR-011, SC-006.)*
7. **No runtime code loading.** A model is registered only via the in-repo static
   import list; nothing constructs a `NodeModel` from a diagram file or other
   input. *(FR-013.)*

## Registry assembly contract

```ts
// registry/index.ts — the ONE place built-in types are enumerated.
export const registry: Registry = buildRegistry([
  clientPoolModel,
  externalApiModel,
  saturatingHostModel,
  queueModel,
])
// buildRegistry throws on a duplicate `id` (FR-009) or an incomplete model.
```

- `registry.resolve(sim)` maps a diagram node's `kind`/`profile` to its model
  (R6); returns `undefined` for an unknown kind → the caller degrades it to a
  plain visual node (FR-007). The serialized `kind`/`profile` shape and
  `DIAGRAM_SCHEMA_VERSION` are unchanged (no bump).

## What this contract does NOT include (scope guard)

- **No new user-facing node type or parameter ships** under this contract in
  this feature. The contract *enables* additions mechanically, but any real new
  type/parameter still requires a Constitution Principle I amendment. The only
  new model exercised here is a **test-only fixture** inside the conformance
  suite (never exported). *(plan Constitution Check, FR guardrail.)*
- **No config-panel binding** — `paramSchema` is declared as data now; the
  canvas consuming it is the deferred D3 follow-up.

## Conformance obligations (a model MUST pass)

`sugar/src/conformance/` iterates the registry and asserts, per model:
determinism · finite/no-NaN · flow conservation · sourced formulas · schema
round-trip. A test-only fixture model proves that adding a model touches only
its own file + the one registration line, with **zero** edits to the propagation
loop *(SC-001, SC-003)*.
