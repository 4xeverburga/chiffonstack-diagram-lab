# Assessment: agent-skill distribution, privacy-first sharing, and the node-model registry

Date: 2026-07-13 (rev 3). Grounded in the actual code on diagram-lab `dev` and
the public `sugar` repo.

**Changes since rev 2:** Goals A and the versioned-schema keystone are **shipped**
(`sugar-skills@0.3.0`, both repos now public — sugar MIT, diagram-lab BSL 1.1),
so §2 and §4.1 are compressed to done-summaries. The sharing thesis is
tightened: **no diagram data ever goes in a URL** — the URL-fragment and KV
shortener ideas are scrapped. Loading a diagram is file-based: drag-and-drop /
file-picker for humans, and an agent with browser-MCP (e.g. Playwright) uploads
the file to the demo itself. Sharing = the JSON file, full stop.

## 0. The strategy in one paragraph

Same three-layer value stack as rev 1 — headless engine as the commons, the
SUGAR canvas UI as the flagship consumer, distribution as the growth engine.
The engine extraction is **done** (`sugar`, MIT, on npm; diagram-lab consumes
it), and the agent skill is **done** (`sugar run`/`sugar sweep` + SKILL.md,
`npx skills`-installable). What remains is the hosted demo that closes the
loop — agent recommends a fix → the diagram opens in the demo and you watch it
collapse — plus sharing polish and the node-model registry. Sharing is
**privacy-first and file-based**: the artifact is a JSON file the user controls,
shared over whatever channel they already trust. No diagram content is ever
encoded into a URL or POSTed to a server by default; the demo loads a file the
user (or their agent) hands it, never a link.

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

## 2. Goal A — Ship the agent skill — ✅ DONE

Shipped in `sugar-skills@0.3.0` (public repo, `npx skills add 4xeverburga/sugar`).
The distribution insight held: Agent Skills is an open standard (one `SKILL.md`
works across Claude Code, Codex CLI, Gemini CLI, Cursor, …), and Vercel's
`npx skills` CLI handles per-harness install dirs — so one skill folder in the
single engine+skill repo (§1.1) covers every harness, no translator.

What shipped (was A1–A6):

- **`sugar run <diagram.json>`** — headless deterministic runner (`src/runner.ts`),
  `--duration`/`--seed`/`--window`/`--json`/`--raw`.
- **Agent-facing summary** (`src/summary.ts`) — steady state per node (averaged
  over the trailing 25% of windows to smooth Poisson noise), first-saturation
  order, backlog growth, scaling events; raw windows behind `--raw`.
- **`sugar sweep --param <node>.<field> --from X --to Y`** (`src/sweep.ts`) —
  binary-searches the breaking point and names the node that gives out first.
- **`SCHEMA.md`** — the written topology contract; `src/diagramInput.ts` its
  executable counterpart, accepting diagram JSON (app-export `data.sim` nesting
  or a flattened form) with label passthrough into summaries.
- **`SKILL.md`** + four topologies in `sugar/examples/` (checkout-system,
  web-tier-and-db, queue-backed-workers, collapse-demo).

**Open follow-up:** SKILL.md's "see it live" link points at the repo README
until the hosted demo (§3) exists. Once the demo is live, SKILL.md should also
gain an optional "view it with browser-MCP" note (§3, B4).

---

## 3. Goal B — Hosted demo UI — ✅ DONE (2026-07-13)

The skill's output is text; the UI is the proof. A public deployment lets a
skill user open the topology the agent produced and watch it saturate — zero
install, and it advertises the full product from inside every agent session.

**Shipped:** the demo *is* diagram-lab itself, live at **sugar.kekeros.com**
(Cloudflare Pages, `wrangler.jsonc → ./dist/`) — there was never a separate
site to build. Delivered: **B1** production build pinned to `sourcemap: false`
(verified: zero `.map` files emitted); **B2** file-based load — dropping a
`.json` on the canvas now imports it (shared `importDiagramFromFile` with the
existing real `<input type="file">`) plus a deterministic ready-signal
`[data-testid="diagram-status"]` exposing `data-diagram-source`/`-node-count`/
`-edge-count`/`-run-status` and an aria-live status line (run stays manual);
**B3** cross-links (sugar README + SKILL.md → sugar.kekeros.com, demo header →
the sugar repo); **B4** the autonomous browser-MCP path, verified end-to-end
with Playwright `browser_file_upload` → the signal flips to
`data-diagram-source="file"`. The gap analysis below is retained for context.

### Gaps (resolved — see "Shipped" above)

**B1. Deploy target exists, demo posture doesn't.** `wrangler.jsonc` already
serves `dist/` as static assets — deploying is not the gap. The gap is build
posture: Vite already minifies for production; additionally ship **no source
maps** (`build.sourcemap: false`) and strip dev artifacts, so the shipped
bundle can't be reconstructed back into readable source. Be honest about the
threat model: minification deters casual copying only — the real IP protection
is the BSL license plus the fact that the *engine* is already open (MIT), so
the only thing obscured is UI code. Don't over-invest; "no sourcemaps +
minified" is the right level.

**B2. Load a topology from a file — never from the URL.** Deliberate decision:
**no diagram data goes in the URL** (no `#fragment`, no query param). Long,
fragile links; the payload leaks into browser history and shared-link logs;
and it's an XSS surface. Instead the entry path is file-based:

- A prominent **drag-and-drop + file-picker** affordance on first load,
  backed by a **real `<input type="file">`** (the drop zone wraps it, it isn't
  a synthetic-drop-only widget). `parseDiagram` already exists and is tolerant;
  it's only wired to a hidden upload today — surface it as the primary boot
  affordance.
- A **deterministic "diagram loaded / simulation ready" signal** in the DOM
  (a `data-testid` or an accessible status region) so an automated driver
  knows when to read the result.

This keeps sharing purely file-based (§4) and makes the demo trivially
scriptable by agents (B4).

**B3. Cross-linking.** `sugar/`'s README + SKILL.md link to the demo; the
demo links back to `sugar/` ("run this from your agent"). This loop is the
whole distribution story — make both edges explicit.

**B4. Autonomous agent path (browser-MCP).** For a fully autonomous "author →
run → *show me*" loop, an agent with a browser-MCP tool (e.g. Playwright)
drives the hosted demo itself: `browser_navigate` to the demo, `browser_file_upload`
onto the real `<input type="file">` from B2 (no synthetic drag needed), wait on
the B2 ready-signal, `browser_take_screenshot`. Nothing to build in `sugar` for
this — browser-MCP is provided by the agent's harness, not the CLI (and the
MIT CLI can't bundle the BSL UI anyway). The only requirements are the B2 real
input + ready-signal; SKILL.md documents the flow as an **optional** "to see
it" section (many harnesses lack a browser tool). Note the demo is the visual
*proof*; the *answer* still comes from `sugar run`'s text, no browser needed.

---

## 4. Goal C — Sharing, privacy-first and file-based

**Sharing is the JSON file — the only mechanism.** The URL-fragment and KV
shortener ideas from rev 2 are **scrapped**: no diagram content is ever put in
a URL or POSTed to a server. Rationale — devs modeling proprietary architectures
will not send their blueprints anywhere, URLs carrying data are fragile and
leak into history/logs, and a server-stored payload is a liability with no
demand behind it. The artifact is a file the user controls, shared over
whatever channel they already trust (their repo, Slack, email); the demo loads
that file directly (§3 B2), and an agent uploads it via browser-MCP (§3 B4).
`exportDiagram.ts`'s whitelist-on-export / tolerate-on-import machinery is
already the right shape.

**C1. Export UX polish (⬜ the only open item here).** `schemaVersion` is
stamped as the first key (✅ done, §4.1) — so field order is already stable and
diff-able for architecture files committed to repos. What remains: an "images
included/stripped" choice at export time (strip embedded base64 images by
default on share — the *architecture* is the payload; images are a size and an
accidental-leak problem).

### 4.1 Cross-cutting keystone — ✅ DONE (versioned schema)

`DIAGRAM_SCHEMA_VERSION = 1` in `sugar/src/config.ts` (barrel-exported) is the
single source of truth; `sugar/SCHEMA.md` is the written document; the export
stamps `schemaVersion` as its first key (diagram-lab PR #7); both parsers (app +
CLI) accept `≤ current` forever, degrade unknown node kinds to visual nodes, and
notice a newer version. diagram-lab mirrors the constant locally until it bumps
to a `sugar-skills` release that exports it.

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
  runtime-loaded plugin code — with diagram files loaded from anywhere,
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
   existing CF assets target; file-based load-on-boot (drag-drop + real
   `<input type="file">` + a "ready" signal, **no URL inputs**); cross-links
   with the skill repo; browser-MCP-scriptable for autonomous agents (B4).
   Small, multiplies the skill's value, and closes A5's open demo link.
4. **Sharing polish (Goal C):** the one remaining item is the export "images
   included/stripped" choice — `schemaVersion` / stable order already done, and
   URL/KV sharing is scrapped.
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
- **Privacy is a positioning claim — make it verifiable:** "your diagram never
  leaves the browser" must stay literally true. With URL/KV sharing scrapped,
  the only paths are the local file and the in-browser render — keep it that
  way. One analytics call that includes diagram content, or any silent POST of
  a diagram, burns the exact audience this pivot targets.
- **Skill-ecosystem drift:** the Agent Skills standard and `npx skills`
  tooling are young; re-verify the install story at ship time rather than
  trusting today's snapshot.
