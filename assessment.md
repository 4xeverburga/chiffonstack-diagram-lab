# Assessment: engine extraction, contributor-pluggable node models, agent-skill export, and shareable URLs

Date: 2026-07-08. Grounded in the actual code on `dev` (post 012-overload-collapse).

## 0. The strategy in one paragraph

The plan is a three-layer value stack: (1) a headless, open-source simulation
engine whose node models anyone can contribute to, (2) the SUGAR canvas UI as
the flagship consumer, and (3) distribution — an agent skill wrapping the
headless engine, plus reliably shareable architecture URLs. The engine is the
commons that attracts contributors; the skill and the UI are the products; the
URL is the viral loop. This assessment maps each layer against what exists
today and names the gaps.

---

## 1. Where the codebase already is (the part that's done right)

- **The engine is genuinely headless.** `src/engine/` (13 files, ~2,300 LOC)
  imports nothing from React/DOM/xyflow/Zustand — the boundary is documented in
  `src/engine/ports.ts` and enforced by an oxlint override. `Simulation` is
  clockless (`tick(elapsedMs)` driven), the traffic source and metrics sink are
  injected ports, and randomness is a seeded `mulberry32`. It would run in Node
  today, unmodified. This is the single most important precondition for both
  the library split and the agent skill, and it's already met.
- **Determinism is real.** Seed flows in through `workerProtocol.ts`'s `init`
  message; `test/engine/` exercises full windows with fixed steps. An agent
  skill can promise reproducible runs.
- **A serialization format exists and is defensively parsed.**
  `src/lab/exportDiagram.ts` whitelists fields on export and tolerates unknown/
  legacy shapes on import (retired roles degrade to plain visual nodes with a
  console notice). That tolerance pattern is exactly what shared-forever URLs
  need — it just isn't formalized yet (see §5.1).
- **Formulas are already first-class data.** `FormulaDescriptor` (id, name,
  expression, inputs, sources, isBinding) travels inside `MetricsWindow`. The
  "traceable formulas" constitution principle is the natural spine of a
  contribution contract: a contributed model that ships descriptors with real
  citations is reviewable; one that doesn't is rejectable by CI
  (`validateFormulaDescriptorsHaveSources` already exists).
- **A Cloudflare foothold exists.** `wrangler.jsonc` deploys `dist/` as static
  assets. Adding a Worker + KV binding is an increment, not a new platform.

---

## 2. Goal A — Decouple the UI from the engine

### Current coupling map

| Layer | Imports engine? | Imports UI libs? | Verdict |
|---|---|---|---|
| `src/engine/` | — | no | clean |
| `src/sim/` (adapter) | yes | `@xyflow/react` types, `zustand`, `react` | mixed concerns |
| `src/lab/` + `App.tsx` | 17 files import from `src/engine/` | yes | expected, but too wide |

### Gaps

**A1. No package boundary — the engine is a folder, not an artifact.**
`package.json` is a single private Vite app. There is no `exports` map, no
library build, no independent versioning. "Export as an agent skill" and "let
people build on the engine" both require `@chiffonstack/sugar-engine` (or
similar) to exist as an installable unit. Options: npm workspaces monorepo
(`packages/engine`, `packages/app`, later `packages/skill`, `packages/share-worker`)
or a single package with subpath exports. Workspaces is the honest answer given
four planned artifacts. Note this collides with the CLAUDE.md "root-relative
imports" convention — the convention should be restated per-package.

**A2. `src/sim/store.ts` binds the adapter to xyflow.** `buildSimTopology(nodes:
Node[], edges: Edge[])` takes React Flow types and digs `data.sim` /
`data.simConfig` out of them. The engine-facing translation should accept a
structural shape (`{ id, sim }[]`, `{ id, source, target, config }[]`) so the
same adapter serves the headless runner; the xyflow unwrapping belongs in the
app layer. Same file mixes the Zustand store (UI state) with topology
building (domain translation) — split them.

**A3. `src/engine/config.ts` mixes engine physics with presentation tuning.**
`SIM_TICK_MS`, `HOST_RHO_CLAMP`, collapse constants — engine. But
`SIGMOID_MAPPING_BY_TRAFFIC_SCALE`, `TRAFFIC_SCALE_LABELS` (user-facing dropdown
strings!), and the flow-animation smoothing config are presentation concerns
that force `App.tsx` to import from `engine/config`. Likewise
`sigmoidMapping.ts` and `flowAnimationSmoothing.ts` are throughput→animation
mapping — pure math, but *visual* math. Decide: either they move to a
`packages/engine-viz` (or into the app), or the engine package documents them
as an optional "presentation helpers" subpath. They should not be in the core's
public API.

**A4. No defined public API surface.** 17 UI files import engine internals
directly (`hostModel`, `formulaCatalog`, `config`, `ports`, …). Before
publishing, the engine needs an `index.ts` barrel that names what's public
(`createSimulation`, port types, `SimTopology`, metric types, `PoissonTrafficSource`,
`mulberry32`, selected constants) and a commitment that everything else may
churn. Every UI import should go through it, so the package boundary is
mechanical to introduce later.

**A5. The worker adapter is app-owned but generally useful.** `simWorker.ts` +
`workerProtocol.ts` are engine-agnostic hosting code any browser consumer
would want. Ship them with the engine package (as an optional entry, e.g.
`@chiffonstack/sugar-engine/worker`) rather than leaving each consumer to
rewrite the auto-pause/status protocol.

---

## 3. Goal B — Modularize node models so anyone can contribute

This is the largest refactor and the one with a real design decision inside it.

### Current shape: a closed world

`NodeSim` is a closed discriminated union in `ports.ts` (5 host profiles + 1
queue kind). Behavior is dispatched by string comparison on `sim.profile`
scattered across the engine:

- `components.ts` — `profile === 'client_pool'` picks generators
- `simulation.ts` — three-profile checks decide who gets a `ReplicaRuntime`
- `flowPropagation.ts` — `isSaturatingProfile`, `hostCapacityRPS`,
  `hostAcceptCapacityRPS` all switch on profile/configMode; queue vs host is
  an if/else in the main loop
- engine-owned cross-window state is hardcoded per kind: `queueBacklogGB` for
  queues, `replicaRuntimeByNode` for saturating hosts

And on the UI side, adding a node kind today touches at least:
`hostConfigFields.tsx` (hand-written inspector form), `nodePalette.ts`,
`nodeKinds.ts`, `exportDiagram.ts` (`plainNodeSim` whitelist validation),
`formulaCatalog.ts`, plus tests. **Six-plus files across two layers per
contribution is a contribution-killer.**

### Gaps

**B1. No behavior contract.** The target is a `NodeModel` (or "component
model") registry entry that owns everything the engine currently hardcodes:

```
interface NodeModel<Config, State> {
  kind: string                        // namespaced: 'core/host', 'community/redis-cache'
  paramSchema: ParamSchema            // drives Inspector form, import validation, docs
  validateConfig(raw: unknown): Config | undefined   // replaces plainNodeSim branch
  initialState(config: Config): State                // replaces hardcoded backlog/replica maps
  isTrafficSource(config: Config): boolean           // replaces client_pool checks
  computeWindow(input): { metrics, formulas, nextState, forwardedRPS, acceptCapacityRPS }
}
```

The per-window loop in `flowPropagation.ts` becomes: resolve topological
order → for each node, call its model's `computeWindow` with inbound RPS and
prior state. The existing host/queue/client-pool logic becomes the three
built-in models — the reference implementations contributors copy.

**B2. Engine cross-window state must generalize.** `simulation.ts` keeps
`queueBacklogGB` and `replicaRuntimeByNode` as named maps with kind-specific
reset/reclamp logic. Generalize to one `stateByNode: Map<string, unknown>`
owned by each node's model (`initialState` / `reconcileState` on live topology
edits — the reclamp-vs-reset distinction in `loadTopology` must become a model
hook, since "preserve sustain/cooldown across a live edit" is model-specific
knowledge).

**B3. The Inspector must become schema-driven.** `hostConfigFields.tsx` /
`edgeConfigFields.tsx` are hand-built per profile. If contributed models are
to appear in the UI without UI PRs, `paramSchema` (fields, types, ranges,
units, help text, conditional visibility like configMode) must be rich enough
for the Inspector to render generically. This is the hidden second half of the
refactor and it's UI work, not engine work.

**B4. Distribution model for contributed code — the key strategic decision.**
Three options, in ascending risk:

1. **In-repo curated registry (recommended start).** Contributions are TS
   modules PR'd into `packages/engine/models/community/`, reviewed, tested,
   shipped with releases. Virality = GitHub contributions. Safe (code review),
   deterministic, and every SUGAR deployment/skill version has an identical
   model set — which shared URLs *require* (a shared architecture referencing
   a model the viewer's build doesn't have is a broken link).
2. **Declarative formula DSL.** Configs carry expressions evaluated by a safe
   interpreter. Maximal shareability (models travel inside the diagram JSON),
   no code execution — but a whole expression-language project, and it caps
   what a model can do (stateful things like the autoscaler don't fit a pure
   expression).
3. **Runtime-loaded plugins (npm/URL).** Do not do this while URLs are a
   distribution channel: a shared link that causes third-party code execution
   in the viewer's browser is an XSS factory.

Start with (1); design the `kind` namespace and schema so (2) can be layered
on later for simple capacity-curve models.

**B5. No conformance suite.** For PRs from strangers, review must be cheap.
Ship a reusable behavior test kit: determinism (same seed ⇒ same windows),
conservation sanity (forwarded ≤ accepted inflow unless declared a source),
no NaN/negative metrics, every formula descriptor has ≥1 source, schema
round-trips through export/import. CI runs it against every registered model.

**B6. No contributor surface.** Missing entirely: `LICENSE` file (README says
"open-source" but the repo ships no license — **nothing else in the virality
plan works until this exists**), CONTRIBUTING.md, a "write your first node
model" tutorial, PR template requiring citations. The constitution's
sourced-formula principle should be recast as the *contribution bar*: your
model merges when its math is cited and its tests pass.

---

## 4. Goal C — Export the headless project as an agent skill

### Gaps

**C1. No headless entrypoint.** The engine runs anywhere, but nothing invokes
it outside the Web Worker. Needed: a small runner package/CLI —
`sugar-sim run topology.json --duration 300s --seed 42 --out windows.json` —
that loads a topology, ticks virtual time as fast as the CPU allows (no
`setInterval`; simulated minutes complete in wall-clock milliseconds), and
emits results. ~100 LOC on top of the existing ports; the worker (`simWorker.ts`)
is the template.

**C2. No agent-friendly output.** `MetricsWindow` per 200ms of sim time is
far too verbose for a model's context window. The skill needs a summarizer:
final steady-state per node (status, ρ, latency, shed), first-saturation
ordering ("db-1 saturates first at t=42s"), backlog growth rates, scaling
event log. Design the summary as the primary output; raw windows behind a flag.

**C3. The killer skill verb is missing: breaking-point search.** The question
agents will be asked is "will this hold at 10×, and where does it break?" A
`sugar-sim sweep --param <clientPool>.requestRatePerSec --from 100 --to 100000`
that binary-searches for the first collapse/saturation is a pure loop over the
existing engine and turns the skill from "runs a sim" into "answers the
question." Nothing in the engine blocks this.

**C4. No input schema documentation.** For an agent to *author* topology JSON
(not just replay exports), the diagram/topology format needs a written schema
(JSON Schema or a precise markdown contract) with field semantics, units, and
constraints — the knowledge currently embedded in `plainNodeSim`'s validation
code and scattered spec files. This doubles as the shared-URL format spec and
the contributor param-schema docs; write it once (see §5.1).

**C5. The skill package itself.** A `SKILL.md` (when to use, how to author a
topology, how to run/sweep/interpret), bundled examples (3–4 canonical
topologies: web tier + DB, queue-backed worker pool, fan-out, collapse demo),
and the pinned engine version. Distribution: an npm package the skill invokes
via `npx`, or the skill vendors the built engine. Decide versioning policy —
the skill's SKILL.md documents schema version N; engine releases must state
which N they accept.

**C6. UI-topology vs engine-topology mismatch.** The natural agent format is
the *diagram* JSON (has labels agents need for readable output), but the
engine takes `SimTopology` (ids only). The runner should accept diagram JSON
and reuse the translation — which requires §A2's decoupling of
`buildSimTopology` from xyflow types, and label passthrough into summaries.

---

## 5. Goal D — Shareable architecture URLs (Cloudflare KV shortener)

### Gaps

**D1. Consider the zero-backend floor first.** A diagram compressed
(lz-string / native `CompressionStream`) into a URL fragment (`#d=...`) needs
no storage, never expires, and works on any static deploy. Text-only diagrams
(the common case) compress to low single-digit KB — long but functional links.
Recommendation: ship fragment-encoding as the reliability floor, then the KV
shortener as the pretty layer on top (`sugar.link/a1b2c3` → 302 to the app
with the fragment, or the app fetches by id). If KV is ever down or abused,
old short links can degrade but nothing is lost architecturally.

**D2. No Worker, no KV binding.** `wrangler.jsonc` is assets-only. Needed:
a Worker script with `POST /api/share` (validate, store, return id) and
`GET /s/:id` (fetch, redirect/serve), a `kv_namespaces` binding, and routes.
KV fits: 25 MB value limit is ample; ~60s eventual consistency is fine for
"create then paste a link"; reads on the hot path are cheap and cacheable.

**D3. Image payloads break the size story.** `imageUpload.ts` embeds base64
images in node data, so a diagram JSON can be megabytes. Decide the shared
artifact's policy: strip images on share (recommended v1 — the *architecture*
is the payload), or cap total size (e.g. 256 KB) and reject with a clear
message. Fragment encoding (D1) forces this decision anyway: URLs can't carry
megabytes.

**D4. An open write endpoint is free anonymous storage.** Mitigations, all
needed: server-side validation that the payload parses as a diagram (run the
same `parseDiagram` logic in the Worker — another reason it must not import
xyflow, see A2), a hard size cap, Cloudflare rate limiting per IP (Turnstile
if abused), and a TTL policy — e.g. `expirationTtl` of 6–12 months, refreshed
on read, rather than promising permanence you can't moderate. Unguessable ids
(crypto-random, ≥64 bits / 11 base62 chars), no enumeration/listing endpoint,
and a takedown path (even just an email + `DELETE` with an admin token).

**D5. Privacy expectations.** Shared topologies are internal-architecture
sketches — mildly sensitive. Anyone with the link can read it; say so in the
share dialog. Don't log payloads; strip images (D3) to reduce accidental
leakage of screenshots.

**D6. The app can't open a shared diagram yet.** `parseDiagram` exists but is
only wired to file upload. Needed: on boot, check fragment/`?d=` id → fetch →
parse → load, with the existing tolerant-degrade behavior and a visible
"imported from a shared link" state. Also an explicit "Share" action in the
UI that produces the URL (and shows its size/what was stripped).

### 5.1 Cross-cutting: the JSON schema is now a public, versioned contract

This is the keystone gap that D, C, and B all land on. Today the exported JSON
has **no schema-version field** — versioning is implicit in `plainNodeSim`'s
absence-based back-fills (legacy boot delay, watermarks, overload behavior).
That works for files you re-import yourself; it's too fragile for URLs that
live for years, skills pinned to old versions, and community node kinds.
Needed:

- `schemaVersion` (or `sugarVersion`) field written on export/share.
- A written schema document (serves C4, B3, D2 validation simultaneously).
- A compatibility policy: parsers accept ≤ current version forever
  (the existing tolerance machinery is 90% of this); unknown node kinds
  degrade to visual nodes exactly like retired roles do today, with a UI
  notice ("this diagram uses `community/foo` from a newer version").

---

## 6. Suggested sequencing

Each phase ships something usable on its own; later phases get cheaper
because of earlier ones.

1. **License + schema formalization** (small, unblocks everything):
   add LICENSE, add `schemaVersion` to export/share format, write the
   topology schema doc, define the engine's `index.ts` public barrel.
2. **Adapter cleanup (A2/A3/A4):** de-xyflow `buildSimTopology`, evict
   presentation config from `engine/config.ts`, route all UI imports through
   the barrel. Pure refactor, fully covered by existing tests.
3. **Headless runner + skill (C):** CLI runner, summarizer, sweep command,
   SKILL.md, examples. Fastest path to new distribution — doesn't wait for
   the plugin refactor, because the built-in models are already valuable.
4. **Share URLs (D):** fragment encoding + open-from-URL in the app, then the
   KV Worker. Independent of everything except phase 1's schema work.
5. **Node-model registry (B):** the big refactor — behavior contract,
   generalized state, schema-driven Inspector, conformance kit,
   CONTRIBUTING.md. Do it last: by then the public schema, package boundary,
   and skill exist, so the contribution story lands with distribution already
   in place ("write a model, it ships in the app, the skill, and every shared
   link").
6. **Workspace/package split (A1):** can happen alongside 3–5; do it no later
   than the first npm publish.

## 7. Top risks

- **Scope trap in B:** the registry + schema-driven Inspector is easily 3–5×
  the effort of any other phase. The strategy survives without it for months
  (contributors can PR into the closed union meanwhile); don't let it block
  the skill or URLs.
- **No license = no virality.** Trivial to fix, fatal to ignore.
- **Shared-link permanence vs. moderation:** promise "long-lived", not
  "forever"; keep the fragment fallback so links outlive the KV store.
- **Plugin security:** hold the line against runtime-loaded code while URLs
  are a distribution channel (B4).
