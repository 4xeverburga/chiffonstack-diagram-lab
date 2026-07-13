# Assessment: agent-skill distribution, privacy-first sharing, and the node-model registry

Date: 2026-07-08 (rev 2, post engine extraction). Grounded in the actual code
on diagram-lab `dev` and the extracted `sugar` repo.

## 0. The strategy in one paragraph

Same three-layer value stack as rev 1 — headless engine as the commons, the
SUGAR canvas UI as the flagship consumer, distribution as the growth engine —
but two things changed. First, the engine extraction is **done**: `sugar` is a
standalone MIT-licensed repo published to npm, and diagram-lab consumes it as
a dependency, so all of rev 1's Goal A is scrapped from this document. Second,
the distribution thesis is revised: the primary channel is an **agent skill on
the open Agent Skills standard** (one SKILL.md, every major harness), and
sharing is **privacy-first** — JSON export/import stays a first-class,
permanent feature because devs will not send proprietary architecture
blueprints to anyone's server, "it's only CSR, pinky promise" included. URL
sharing is a convenience layer on top, not a replacement. A hosted demo UI
(minified, no source maps) linked from the skill repo closes the loop: agent
recommends a fix → user opens the diagram in the demo and sees it collapse.

---

## 1. What is already done (scrapped from rev 1)

Rev 1's Goal A (decouple UI from engine) shipped in full:

- **The engine lives in its own repo** — `github.com/4xeverburga/sugar`,
  published to npm as `sugar-skills@0.2.1` (MIT LICENSE, `dist/` build with
  ESM-correct `.js` extensions, `prepublishOnly` gate of typecheck + tests).
- **diagram-lab consumes it as a normal dependency.** `src/engine/` is deleted
  (commit `591ec87`); 28 files import from the `sugar-skills` barrel.
- **The public API barrel exists** (rev 1 A4): `src/index.ts` in the engine
  repo names the supported surface (`createSimulation`, `buildSimTopology`,
  ports, Poisson source, `mulberry32`, selected constants); everything else is
  documented as churnable internals.
- **Topology building is de-xyflow'd** (rev 1 A2): `buildSimTopology` takes
  structural `TopologyNodeInput`/`TopologyEdgeInput`, not React Flow types.
  The engine can now validate/run diagrams in a Worker, Node, or a CF Worker.
- **Presentation math moved to the app** (rev 1 A3): `sigmoidMapping`,
  `flowAnimationSmoothing`, traffic-scale presets now live in
  `diagram-lab/src/lab/animation/`. The engine package is physics only.
- **License gap closed** (rev 1 B6's fatal blocker): MIT, in the repo and on
  npm.

Still app-owned from rev 1 A5: `simWorker.ts`/`workerProtocol.ts`. Fine for
now — revisit only if a second browser consumer appears.

### 1.1 One repo, two roles — not a collision

`sugar/` is a single repo that is deliberately both the engine and the skill:
it publishes unscoped as `sugar-skills@0.2.1` on npm, and the CLI/skill
scripts (`sugar/src/cli.ts`, §2) live in the same package rather than a
separate one. There was a stray `sugar-skills/` scaffold directory sitting
next to it in the ChiffonStack workspace (two orphaned files, no `.git`,
never deployed or referenced) that looked like a second, competing package —
it has since been deleted. There is no naming collision and nothing to
rename: `sugar-skills` is already the correct, live, unscoped name for the
combined engine+skill package.

The one implication worth stating explicitly: because it's one package, the
skill and the engine **version and release together**. A breaking engine
change and a SKILL.md change ship in the same npm release — there's no
separate skill-version-vs-engine-version matrix to track, which simplifies
§2's "pin the skill to an engine version" concern (rev 1 wording assumed two
packages; there's only one to pin).

---

## 2. Goal A — Ship the agent skill, distributed to every harness

> **✅ DONE (2026-07-13, shipped in `sugar-skills@0.3.0`).** All gaps below
> (A1–A6) are closed: `sugar run` / `sugar sweep`, the agent-facing summarizer,
> `SCHEMA.md`, `SKILL.md`, and four bundled examples all ship in the public
> sugar repo, installable via `npx skills add 4xeverburga/sugar`. The one
> follow-up is A5's demo link, which depends on Goal B (§3) existing.

This was the front of the queue. The good news from research: **there is no
translation problem to solve.** Agent Skills (a folder with a `SKILL.md`:
frontmatter name/description + markdown instructions) is an open standard
adopted across Claude Code, OpenAI Codex CLI, Gemini CLI, Cursor, GitHub
Copilot and more — the same skill folder works in all of them; only the
install directory differs (`~/.claude/skills/`, `~/.codex/skills/`,
`~/.gemini/skills/`, `.cursor/skills/`, …). And the install-directory problem
is already solved by tooling: **Vercel's `npx skills` CLI** is the de-facto
package manager of the ecosystem (~20k stars, 27+ supported agents) — it
installs a skill from a GitHub repo into whichever agents the user has.

So the distribution plan is: author **one** SKILL.md inside `sugar/` (the
single engine+skill repo, §1.1), make it installable via
`npx skills add 4xeverburga/sugar`, and list Claude Code's native install
path in the README. No per-harness ports, no translator to build or
maintain, and no second repo to keep in sync with the engine.

### Gaps

**A1. ✅ DONE — CLI runner.** Shipped as `sugar run <diagram.json> --duration
300s --seed 42` (`src/runner.ts` + `src/cli.ts`), plus `--json`/`--raw`. Was:
`sugar/src/cli.ts` today prints help and
`install` confirmation only. The skill has nothing to invoke. Needed:
`sugar run topology.json --duration 300s --seed 42 --out windows.json` —
load topology, tick virtual time as fast as CPU allows (no wall-clock timers),
emit results. ~100 LOC over the existing ports; `simWorker.ts` is the
template. The `bin` wiring, ESM build, and npm publish pipeline already exist,
so this is genuinely just the runner logic.

**A2. ✅ DONE — agent-friendly summary.** `src/summary.ts` (`summarizeRun`)
emits steady state per node (averaged over the trailing 25% of windows to
smooth Poisson noise), first-saturation order, backlog growth, and scaling
events; raw windows behind `--raw`. Was: A `MetricsWindow` per 200ms of sim time
will blow any context window. The runner's default output must be a summary:
final steady-state per node (status, ρ, latency, shed), first-saturation
ordering ("db-1 saturates first at t=42s"), backlog growth rates, scaling
events. Raw windows behind `--raw`.

**A3. ✅ DONE — breaking-point search.** `src/sweep.ts` (`sugar sweep --param
<node>.<field> --from X --to Y`) binary-searches the threshold and names the
node that gives out first. Was: Agents will be asked "will
this hold at 10×, and where does it break first?" A
`sugar sweep --param <clientPool>.requestRatePerSec --from 100 --to 100000`
that binary-searches for first saturation/collapse is a pure loop over the
existing engine and turns the skill from "runs a sim" into "answers the
question."

**A4. ✅ DONE — input schema documentation.** `sugar/SCHEMA.md` is the written
contract (profiles, fields, units, constraints, `schemaVersion`, compat
policy); `src/diagramInput.ts` is its executable counterpart. Was: For an agent to *author* topology JSON
(not just replay app exports), the format needs a written contract — JSON
Schema or precise markdown — with field semantics, units, constraints. That
knowledge currently lives in `plainNodeSim`-style validation code and spec
files. This same document serves import validation, the future contributor
param-schema docs, and the share format (§4). Write it once.

**A5. ✅ DONE (demo link pending Goal B).** `sugar/SKILL.md` + four topologies
in `sugar/examples/` (checkout-system, web-tier-and-db, queue-backed-workers,
collapse-demo) ship in 0.3.0. The only open piece is the hosted-demo link,
which needs §3 to exist first (currently points at the repo README). Was: In `sugar/`: `SKILL.md` (when to trigger,
how to author a topology, how to run/sweep/interpret, **and a link to the
hosted demo UI so the user can *see* the result** — §3), plus 3–4 bundled
example topologies (web tier + DB, queue-backed worker pool, fan-out,
collapse demo). Since engine and skill are one package (§1.1), there's no
version-pinning gap between them — the skill just states which schema
version its own release authors.

**A6. ✅ DONE — accepts diagram JSON.** `src/diagramInput.ts` maps diagram
JSON (app-export `data.sim` nesting or a flattened form) to `SimTopology` via
`buildSimTopology`, carrying labels through into summaries. Was: The natural agent format is the
diagram JSON (labels make summaries readable), but the engine takes
`SimTopology` (ids). The runner should accept diagram JSON; the de-xyflow'd
`buildSimTopology` makes this a small mapping layer now, with label
passthrough into summaries.

---

## 3. Goal B — Hosted demo UI (new)

The skill's output is text; the UI is the proof. A public deployment lets a
skill user paste/open the topology the agent produced and watch it saturate —
zero install, and it advertises the full product from inside every agent
session.

### Gaps

**B1. Deploy target exists, demo posture doesn't.** `wrangler.jsonc` already
serves `dist/` as static assets — deploying is not the gap. The gap is build
posture: Vite already minifies for production; additionally ship **no source
maps** and strip dev artifacts. Be honest about the threat model: minification
deters casual copying only — the real IP protection is that the *engine* is
already open source (MIT) and the only thing being obscured is UI code. Don't
over-invest here; "no sourcemaps + minified" is the right level.

**B2. No way to open a topology on boot.** For "agent hands you a link/file →
see it live," the app needs an entry path: at minimum a prominent
import-JSON affordance on first load; ideally `#d=<compressed>` fragment
support (§4.2), which the skill can emit directly. `parseDiagram` exists and
is tolerant; it's only wired to file upload today.

**B3. Cross-linking.** `sugar/`'s README + SKILL.md link to the demo; the
demo links back to `sugar/` ("run this from your agent"). This loop is the
whole distribution story — make both edges explicit.

---

## 4. Goal C — Sharing, privacy-first (revised from rev 1's Goal D)

Rev 1 treated the KV URL shortener as the viral loop. Revision: **devs
modeling proprietary architectures will not POST their blueprints to a
server**, and no CSR pledge changes that. So the sharing stack is reordered
around where the data travels:

1. **JSON export/import — permanent, never deprecated.** The fully-offline
   path: the artifact is a file the user controls, shared over whatever
   channel they already trust (their repo, their Slack, their email). This is
   the privacy floor and for a segment of users it is the *preferred* mode,
   not a fallback. `exportDiagram.ts`'s whitelist-on-export /
   tolerate-on-import machinery is already the right shape — keep investing
   here (schema version, §4.1).
2. **URL-fragment encoding (`#d=<compressed>`) — zero-server sharing.**
   Compress the diagram (lz-string / `CompressionStream`) into the fragment.
   Privacy property worth stating in the UI: **fragments are never sent to
   the server** — the payload travels only inside the link itself, peer to
   peer. No storage, no expiry, works on any static deploy, and doubles as
   the demo-UI entry path (B2). Long URLs, but functional; text-only diagrams
   compress to low single-digit KB. Strip embedded base64 images on share
   (the *architecture* is the payload; images are both a size and an
   accidental-leak problem).
3. **KV shortener — optional, later, clearly labeled.** Pretty links
   (`sugar.link/a1b2c3`) require storing the payload server-side; that's a
   *feature for people who opt in*, presented with an explicit "anyone with
   the link can read this; stored on our infrastructure" notice. All of rev
   1's D4 mitigations apply if/when built (validate-in-Worker, size cap, rate
   limit, TTL not permanence, unguessable ids, takedown path). It is no
   longer on the critical path — build it only when demand shows up.

**C1. Export/import UX should reflect its promotion.** If JSON is a
first-class sharing mode, the export deserves: the schema version stamped in
(§4.1 — ✅ **done**, written as the first key), a stable field order (diff-able
in PRs — ✅ partially: `schemaVersion` leads the object), and an "images
included/stripped" choice at export time (⬜ still open). Only the image-strip
choice remains here.

### 4.1 Cross-cutting keystone — ✅ DONE (versioned schema)

> **✅ DONE (2026-07-13).** `DIAGRAM_SCHEMA_VERSION = 1` in `sugar/src/config.ts`
> (barrel-exported) is the single source of truth; `sugar/SCHEMA.md` is the
> written document; the export stamps `schemaVersion` (diagram-lab PR #7, merged
> to dev) and both parsers (app + CLI) apply the ≤-current compat policy with a
> newer-version notice. diagram-lab mirrors the constant locally until it bumps
> to a `sugar-skills` release that exports it.

This was the gap everything lands on, with three consumers: exported JSON files
that live in repos for years, skill-authored topologies pinned to old engine
versions, and (eventually) shared URLs. Delivered:

- ✅ `schemaVersion` field written on every export.
- ✅ The written schema document (same artifact as A4 — `SCHEMA.md`).
- ✅ Compatibility policy: parsers accept ≤ current version forever; unknown
  node kinds degrade to visual nodes (the retired-roles machinery already
  does this) with a visible notice.

---

## 5. Goal D — Node-model registry (unchanged in substance, still last)

Rev 1 §3 stands as written; the extraction changed its geography, not its
content. Summary of what remains open:

- **D1. Behavior contract**: `NodeModel` registry entry owning
  `paramSchema`, `validateConfig`, `initialState`, `computeWindow`; the
  per-profile string dispatch in `components.ts` / `simulation.ts` /
  `flowPropagation.ts` becomes three built-in reference models. This work now
  happens **in the `sugar` repo**, and lands with better leverage than
  before: a contributed model automatically ships to the app, the skill, and
  every export.
- **D2. Generalize cross-window state** (`queueBacklogGB`,
  `replicaRuntimeByNode` → model-owned `stateByNode` with a reconcile hook).
- **D3. Schema-driven Inspector** in diagram-lab — the hidden second half;
  UI work, not engine work.
- **D4. Distribution model**: still start with the in-repo curated registry
  (PRs reviewed, tested, shipped with releases). Still hold the line against
  runtime-loaded plugin code — with URLs/files as distribution channels,
  third-party code execution in the viewer is an XSS factory. The declarative
  formula DSL remains the possible middle layer, later.
- **D5. Conformance kit** (determinism, conservation, no-NaN, sourced
  formulas, schema round-trip) run by the engine repo's CI against every
  registered model.
- **D6. Contributor surface**: CONTRIBUTING.md, "write your first node
  model" tutorial, PR template requiring citations. LICENSE is done; the
  sourced-formula constitution principle as the contribution bar stands.

---

## 6. Suggested sequencing

1. ✅ **DONE — Schema formalization** (2026-07-13): `schemaVersion` on export
   + `SCHEMA.md` topology doc (serves A4, C1, D3).
2. ✅ **DONE — Headless runner + skill (Goal A)** (2026-07-13, shipped in
   `sugar-skills@0.3.0`): `sugar run`, summarizer, `sugar sweep`, SKILL.md +
   four examples, all in `sugar/`, `npx skills`-installable.
3. ⬅ **NEXT — Demo deployment (Goal B):** no-sourcemap production build to the
   existing CF assets target; import-on-boot (file + fragment); cross-links
   with the skill repo. Small, and multiplies the skill's value — also closes
   A5's open demo link.
4. **Sharing polish (Goal C):** export UX upgrades (image strip choice —
   stable ordering / `schemaVersion` already done), fragment encoding. KV
   shortener deferred until demanded.
5. **Node-model registry (Goal D):** the big refactor, still last, now in
   the engine repo — by then schema, skill, and demo exist, so contributions
   land with distribution already in place.

## 7. Top risks

- **Scope trap in D** (unchanged): registry + schema-driven Inspector is
  3–5× any other phase; don't let it block the skill or the demo.
- **Pre-v0.1 API churn vs pinning:** diagram-lab and exported files pin a
  `sugar-skills` version. Until `1.0.0`, every release must say which schema
  version it reads/writes, or old exports quietly rot. (The skill itself
  doesn't need separate pinning — it ships in lockstep with the engine, §1.1.)
- **Privacy is a positioning claim — make it verifiable:** "your diagram
  never leaves the browser" must stay literally true in the default paths
  (JSON, fragment). One analytics call that includes diagram content, or a
  share default that POSTs silently, burns the exact audience this pivot
  targets.
- **Skill-ecosystem drift:** the Agent Skills standard and `npx skills`
  tooling are young; re-verify the install story at ship time rather than
  trusting today's snapshot.
