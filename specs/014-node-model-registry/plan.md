# Implementation Plan: Node-Model Registry

**Branch**: `014-node-model-registry` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-node-model-registry/spec.md`

## Summary

Re-express the simulation engine's closed set of node behaviors (the `host`
profiles and the `queue`) as entries in a **registry keyed by node kind**, so
the engine consults the registry instead of branching on `sim.profile` /
`sim.kind` strings at ~39 scattered sites across 7 files. Each entry owns its
parameter schema, config validation, initial cross-window state, and its
per-window behavior. This is a **behavior-preserving refactor** plus a
**conformance kit** — it ships the registry and migrates the existing models; it
does **not** add any new user-facing node type or parameter (that remains gated
by the constitution, Principle I).

The technical crux (see [research.md](./research.md)): the engine does
**whole-graph flow propagation in topological order** with downstream
**backpressure** (a queue's outflow depends on its downstream host's
accept-capacity). A `NodeModel` therefore cannot be a single
`computeWindow(incoming) → outgoing`; the contract splits into an
**accept-capacity query** (pure, read by upstream nodes during propagation), a
**window computation** (produces metrics + next state + outgoing distribution),
and **state reconciliation** (on graph changes). The propagation loop stays in
the engine and drives models through these hooks.

**Implementation repository**: `sugar` (the engine, published as `sugar-skills`,
MIT). This spec and its artifacts live in `diagram-lab/specs/` for continuity
with the speckit history, but every code change lands in `sugar`. See Project
Structure and research.md "Cross-repo governance".

## Technical Context

**Language/Version**: TypeScript (strict), Node.js native ESM (relative imports
carry explicit `.js` extensions — see `sugar` commit `e87982d`).

**Primary Dependencies**: none at runtime (the engine is dependency-light, pure
TS). Dev: Vitest, the package's existing typecheck + lint gates
(`prepublishOnly`).

**Storage**: N/A — diagrams are plain JSON files; no database. The interchange
schema (`DIAGRAM_SCHEMA_VERSION`, `SCHEMA.md`) is the only persisted contract.

**Testing**: Vitest unit tests (engine convention: every pure formula/function
unit-tested at known operating points, incl. the saturation region), plus a new
**conformance suite** iterating the registry.

**Target Platform**: the engine runs unchanged in a browser Web Worker
(diagram-lab), Node (the `sugar run`/`sugar sweep` CLI + agent skill), and CI.

**Project Type**: library (simulation engine) + CLI, single package.

**Performance Goals**: no regression. Propagation is already O(nodes+edges) per
window in topological order; the registry indirection must stay O(1) per node
lookup (a `Map<kind, NodeModel>`), adding no per-event cost (Constitution V).

**Constraints**: determinism (same seed → identical results, byte-identical
summaries for bundled examples); backward-compatible schema (parsers accept
`≤ DIAGRAM_SCHEMA_VERSION`, unknown kinds degrade to visual nodes); no
runtime-loaded model code (security, FR-013); source files ≤ ~250 lines
(Constitution VI) — each model in its own file; engine stays pure (no React /
DOM / xyflow / Zustand imports, Constitution IV).

**Scale/Scope**: 2 node kinds today (`host` with 5 profiles, `queue`); the
registry generalizes to N. This feature migrates exactly the existing set.

## Constitution Check

*GATE: evaluated against SUGAR Constitution v3.4.0 (Principles I–VI).*
*Re-checked after Phase 1 design — see "Post-Design Re-Check" below.*

| Principle | Verdict | Notes |
|-----------|---------|-------|
| **I. Host-First, Closed Parameter Set** | ✅ PASS (scoped) | The registry re-expresses the **existing closed set**; it adds **no** user-facing parameter and **no** new node type. The spec's "cache / broker" examples describe the *mechanism*, not shipped types — extensibility is proven by a **test-only fixture model** in the conformance suite, never a user-facing node. **Any real new node type or parameter still requires a Principle I amendment.** This guardrail is a hard constraint on the feature, restated in quickstart.md and the conformance kit. |
| **II. Every Formula Is Traceable** | ✅ PASS (reinforces) | D5 conformance *enforces* Principle II: `formulaCatalog.ts` already exposes `validateFormulaDescriptorsHaveSources`; the kit runs it against every registered model, so an uncited formula cannot merge (FR-011, SC-006). A model owns its formula descriptors as structured metadata. |
| **III. Open Source & Web-First** | ✅ PASS | Engine stays MIT, client-consumable, no backend. Schema stays backward compatible (FR-007/FR-008). FR-013 (no runtime plugin code) matches the no-lock-in stance. |
| **IV. Simulation Core Behind Ports** | ✅ PASS (reinforces) | The registry lives **inside** the engine core, pure TS, consumed via the existing topology/metrics ports. It makes the core *more* port-like (behaviors become data-driven entries). ⚠️ *Staleness note:* the constitution text references `src/engine/config.ts`, which no longer exists in diagram-lab (engine extracted to `sugar`). Not a violation; flagged for governance in research.md. |
| **V. Render Discipline** | ✅ PASS (N/A) | Engine-only feature; no per-event messages, no UI animation change. The schema-driven Inspector (D3) that *would* touch render is out of scope (follow-up). |
| **VI. Contributor-Legible Codebase** | ✅ PASS (constraint) | Registry must **split** models into single-purpose files (engine files already sit near the 250-line limit: hostModel 270, flowPropagation 355 — the latter already exceeds and must not grow). No default params; every model function unit-tested. This shapes the file layout (see Project Structure). |

**Gate result: PASS.** No unjustified violations → no Complexity Tracking
entries required. Two flagged notes (scoping guardrail on Principle I;
constitution staleness/governance on Principle IV) are process items carried
into research.md, not gate failures.

### Post-Design Re-Check (after Phase 1)

Re-evaluated against the Phase 1 artifacts (research.md, data-model.md,
contracts/node-model.md, quickstart.md):

- **Principle I** still ✅: the contract (contracts/node-model.md "What this
  contract does NOT include") ships **no** new user-facing type/parameter; the
  cache in quickstart.md is explicitly a test-only fixture; real additions stay
  gated. Guardrail survived the design.
- **Principle II** still ✅ and now concretely: `NodeModel.formulaDescriptors`
  reuses `validateFormulaDescriptorsHaveSources`; conformance (R4) enforces it.
- **Principle IV** still ✅: the three-hook contract (R1) keeps the core pure and
  port-shaped; `stateByNode` is opaque to the engine (R2). No adapter awareness
  leaked in.
- **Principle VI** still ✅: file layout puts each model in its own file and
  *shrinks* the over-limit `flowPropagation.ts` (355 → generic driver).
- No new dependency introduced; determinism strategy (R5 goldens) added.

**Post-design gate: PASS.** No design decision introduced a violation; the
Complexity Tracking table remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/014-node-model-registry/           # in diagram-lab (speckit history)
├── plan.md              # This file
├── research.md          # Phase 0 — key design decisions
├── data-model.md        # Phase 1 — NodeModel/Registry/ParamSchema/NodeState
├── quickstart.md        # Phase 1 — "add a node model" walkthrough (proves SC-001)
├── contracts/
│   └── node-model.md    # Phase 1 — the NodeModel extension contract
└── tasks.md             # Phase 2 — /speckit-tasks (NOT created here)
```

### Source Code (implementation lands in the `sugar` repo)

```text
sugar/src/
├── registry/                     # NEW — the registry and its hooks
│   ├── nodeModel.ts              #   the NodeModel interface (the contract)
│   ├── registry.ts              #   Map<kind, NodeModel>, conflict-checked assembly
│   ├── index.ts                 #   built-in registration (the one place types are listed)
│   └── models/                  #   one file per built-in reference model
│       ├── clientPoolModel.ts   #   (host/client_pool)
│       ├── externalApiModel.ts  #   (host/external_api)
│       ├── saturatingHostModel.ts # (host/transactional_api|worker_consumer|database_server)
│       └── queueModel.ts        #   (queue) — folds today's src/queueModel.ts
├── simulation.ts                 # CHANGED — generalized stateByNode (D2), drives registry
├── flowPropagation.ts            # CHANGED — dispatch via registry hooks, not profile strings
├── summary.ts / topology.ts / diagramInput.ts  # CHANGED — kind/profile checks → registry
├── hostModel.ts / autoscaler.ts / formulaCatalog.ts  # REUSED — models call into these
└── conformance/                  # NEW — D5 kit
    └── conformance.test.ts       #   determinism, no-NaN, flow-conservation, sourced-formula, round-trip, + a fixture model
```

**Structure Decision**: The registry is a new `sugar/src/registry/` module with
one file per built-in model (Constitution VI). The existing pure-math modules
(`hostModel.ts`, `autoscaler.ts`, `formulaCatalog.ts`, `queueModel.ts`) are
**reused unchanged as the models' internals** — the registry entries are thin
adapters that own schema/validation/state and delegate physics to those tested
functions, so this refactor moves *dispatch*, not *formulas* (protecting
determinism, SC-002). `flowPropagation.ts` (already 355 lines, over the limit)
**shrinks**: its per-profile branches move into model files, leaving it the
generic topological-order driver. Spec docs stay in diagram-lab for speckit
continuity; no code changes in diagram-lab this feature (D3 deferred).

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | — | — |
