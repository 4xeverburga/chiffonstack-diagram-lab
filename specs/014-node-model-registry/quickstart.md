# Quickstart: Adding a node model (and what the registry buys you)

This walkthrough is both the contributor path and the **executable proof of
SC-001 / SC-003**: adding a model touches only its own file plus one
registration line — with **zero** edits to the propagation loop or any other
model. All paths are in the `sugar` repo.

> **Scope guard (Constitution I):** this feature does **not** ship a new
> user-facing node type. The example below is exercised as a **test-only fixture**
> inside the conformance suite. Shipping a real new type (a cache, a broker)
> still requires a Principle I constitution amendment.

## 1. Write the model — one new file

`sugar/src/registry/models/cacheModel.ts` (illustrative fixture):

```ts
import type { NodeModel } from '../nodeModel.js'
import { buildCacheHitDescriptor } from '../../formulaCatalog.js' // sourced formula

interface CacheConfig { hitRatio: number; backingCapacityRPS: number }
interface CacheState { /* none needed */ }

export const cacheModel: NodeModel<CacheConfig, CacheState> = {
  id: 'cache',
  label: 'Cache',
  paramSchema: {
    params: [
      { name: 'hitRatio', type: 'number', min: 0, max: 1, unit: 'ratio' },
      { name: 'backingCapacityRPS', type: 'number', min: 0, unit: 'rps' },
    ],
  },
  formulaDescriptors: [/* buildCacheHitDescriptor(...) — carries a citation */],
  validateConfig(raw) { /* range-check → {ok:true,config} | {ok:false,message} */ },
  initialState() { return {} },
  reconcileState(prev) { return prev },
  // PURE: misses fall through to the backing store's capacity.
  acceptCapacityRPS(config) {
    return config.backingCapacityRPS / Math.max(1e-9, 1 - config.hitRatio)
  },
  computeWindow(ctx) {
    const served = Math.min(ctx.incomingRPS, this.acceptCapacityRPS(ctx.config, ctx.prevState))
    return {
      metrics: { throughputPerSec: served, /* status/latency… */ },
      nextState: ctx.prevState,
      edgeDistribution: distributeByShare(ctx, served), // outflow ≤ inflow (conservation)
    }
  },
}
```

## 2. Register it — one line

`sugar/src/registry/index.ts` — the single place node types are enumerated:

```ts
export const registry = buildRegistry([
  clientPoolModel,
  externalApiModel,
  saturatingHostModel,
  queueModel,
  cacheModel, // ← the only edit outside the new file
])
```

That is the whole change. You did **not** touch `flowPropagation.ts`,
`simulation.ts`, `summary.ts`, `diagramInput.ts`, or any other model — the
registry resolves `cache` and drives its hooks generically.

## 3. It passes conformance automatically

`npm test` runs the conformance suite (`sugar/src/conformance/`), which iterates
the registry and checks the new model for:

- **determinism** — same seed → identical metrics/state;
- **finite / no-NaN** output;
- **flow conservation** — `outflow ≤ inflow + released backlog` within ε;
- **sourced formulas** — every `formulaDescriptor` has a citation;
- **schema round-trip** — a default config serializes → parses → equals itself.

A violation names the property and the model and fails the build (FR-011/FR-012).

## 4. What flows for free

Because the engine feeds all three consumers, the new model immediately works
in:

- the **headless runner / agent skill** (`sugar run`, `sugar sweep`);
- every **exported diagram** (round-trips through the unchanged schema);
- the **canvas app** engine (behavior); its config *panel* auto-rendering from
  `paramSchema` is the deferred D3 follow-up.

## Verifying the refactor preserved behavior (US2 / SC-002)

Before/after golden check for every bundled topology:

```sh
# capture goldens on main, before the refactor
for f in examples/*.json; do sugar run "$f" --seed 1 --json > "golden.$(basename "$f").json"; done
# after each migration step, assert byte-identical
for f in examples/*.json; do diff <(sugar run "$f" --seed 1 --json) "golden.$(basename "$f").json"; done
```

Any diff means the migration changed physics — bisect to the single model just
migrated (models move to the registry one at a time, R5). "Done" = no
profile-string dispatch remains in the stepping loop **and** all goldens match.
