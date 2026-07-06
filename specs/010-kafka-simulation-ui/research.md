
# Research: Kafka Simulation UI

No NEEDS CLARIFICATION markers remained in the Technical Context; this
document records the decisions behind each design choice, in particular how
a UI-only feature can be developed and demoed against a contract whose
producer (feature 009) doesn't exist yet.

## D1. Contract ownership while the producer doesn't exist yet

- **Decision**: `KafkaNodeMetrics`, `FormulaDescriptor`, `FormulaSource`, and
  `HardwareProfile` are defined now, by this feature, as pure type/data
  declarations in `src/engine/` (no logic). Feature 009 consumes and extends
  them (adding the formulas that populate `KafkaNodeMetrics`/`FormulaDescriptor`
  for real) rather than redefining them. Any breaking change to the shapes
  after both features have landed goes through the small dedicated contract
  PR the spec's Assumptions section already calls for.
- **Rationale**: someone has to go first, and the UI is what needs the
  shapes concretely typed today (Inspector fields, meters, the formula
  panel). Placing them in `src/engine/` rather than `src/lab/` keeps them
  importable by the eventual engine code without a 009-side move, and
  keeps them under the same oxlint purity rule that already guards
  `src/engine/**` (Principle IV) — so "contract types, no formulas yet" is
  mechanically true, not just a comment.
- **Alternatives considered**: define the contract in `src/lab/` (engine
  would need to import UI-side types — backwards from Principle IV);
  duplicate the shapes in both features and reconcile later (guarantees a
  merge conflict and a period where the two are silently out of sync).

## D2. Fixture-to-live swap: one resolver function, not a UI branch

- **Decision**: `MetricsWindow.nodes[id]` gains two optional fields,
  `kafka?: KafkaNodeMetrics` and `formulas?: FormulaDescriptor[]`, always
  `undefined` until 009 populates them. `src/lab/kafkaNodeData.ts` exposes
  `resolveKafkaMetrics(nodeId, latestWindow)` and `resolveFormulas(nodeId,
  latestWindow)`: each first reads the live window field and falls back to
  the static fixture (`kafkaFixture.ts`) keyed by node id. Every UI
  component (metrics readout, status treatment, formula panel) is written
  once, calling only the resolver — never branching on "are we in fixture
  mode".
- **Rationale**: this is the literal mechanism behind FR-010/SC-005 ("no UI
  rework" when 009 lands) — the day 009 starts emitting real
  `kafka`/`formulas` fields, the live branch simply stops being `undefined`
  and the fixture branch stops being reached, with zero component changes.
  It also means the fixture is real production code (small, typed,
  reviewable) rather than a dev-only shim that has to be torn out later.
- **Alternatives considered**: a build-time flag / mock service worker
  swapping "fixture mode" vs "live mode" (extra moving part, and risks the
  two modes silently diverging in shape); passing fixture data as props
  from a special demo route (doesn't exercise the real selection/Inspector
  path the spec's Independent Tests require).

## D3. Hardware profile catalog: small static list, not user-editable yet

- **Decision**: `src/engine/hardwareProfiles.ts` exports a fixed
  `HARDWARE_PROFILES: HardwareProfile[]` (~5 entries spanning small to
  large instances) with `vCpu`, `ramGB`, `networkGbps`, `diskType`,
  `diskIops`. The Inspector's Kafka picker lists them with these specs
  visible (FR-001 acceptance scenario 1); the node stores the chosen
  `hardwareProfileId`, not a copy of the specs (so a later catalog edit
  updates every node that references it).
- **Rationale**: FR-001 only requires a picker with visible specs, not
  catalog management UI; a static list is the smallest thing that satisfies
  it and gives 009 concrete numbers to plug into its bandwidth/vCPU
  formulas later.
- **Alternatives considered**: free-form vCPU/RAM/network number inputs
  (fails "hardware profile picker" wording and loses the "real hardware
  profiles" product framing in PRODUCT.md); user-defined catalog editing
  (explicitly out of scope — not in any FR).

## D4. Status badge & canvas treatment: token-derived, shape-redundant

- **Decision**: exactly three statuses (`healthy`/`saturated`/`degraded`).
  `healthy` applies no extra treatment. `saturated` and `degraded` each add
  one idempotent CSS class (derived only from the existing `--token-primary`/
  `--token-secondary` custom properties plus opacity/border-style, no new
  token) *and* a small text badge (not color-only), so both remain
  distinguishable under low-contrast user tokens (spec Edge Cases,
  accessibility fallback). The binding-constraint highlight in the metrics
  panel and the formula panel always agree (FR-005) because both read the
  same `bindingConstraint` field off the same resolved `KafkaNodeMetrics`.
- **Rationale**: FR-006 forbids a new node visual component and forbids
  color-only signaling; reusing `--token-primary`/`--token-secondary` with
  different border-style/opacity per status plus a text badge satisfies
  both constraints without inventing anything.
- **Known pitfall to avoid (from prior 008-era bug)**: deriving a node's
  status className by appending to whatever `node.className` currently is,
  on the same node objects passed into `<ReactFlow nodes={...}>`, can bake
  the class in permanently — `useReactFlow().updateNode` spreads onto the
  *current* store node, so any later `updateNode` call (e.g. from
  `NodeResizer`) re-adopts a stale class. The derivation in
  `kafkaStatusTreatment.ts` MUST be idempotent: strip any previously-applied
  status token from `className` before deciding whether to add the current
  one, every render, regardless of what's already there.
- **Alternatives considered**: a wrapper `<div>` around the node content
  (extra DOM layer, still needs the same idempotency care, no real
  benefit); driving status via inline style only (fails the
  not-color-alone requirement on its own — still needs the badge).

## D5. Dual-unit edges: pure conversion, no new "formula"

- **Decision**: `src/engine/unitConversion.ts` exports
  `convertReqPerSecToMBPerSec(reqPerSec, avgPayloadBytes)` — pure
  multiplication, no service model. `HeatEdge` (or its label) shows both
  units when the edge's source node is a `producer` (has
  `avgPayloadBytes`) and its target is a `kafka` node, reading edge
  throughput from the same resolver pattern as node metrics (fixture
  fallback pre-009).
- **Rationale**: the constitution explicitly exempts "edge unit converters
  RPS ↔ MB/s" from Principle I's formula-sourcing gate ("infrastructure,
  not models") — no source citation is owed for unit math, but it still
  gets a unit test per Principle VI (pure logic must be tested).
- **Alternatives considered**: folding the conversion into
  `KafkaNodeMetrics` itself (mixes a generic, source-exempt utility into a
  Kafka-specific, sourced contract — wrong ownership).

## D6. Validation pattern: reuse 008's inline-reject, never-clamp shape

- **Decision**: every new Inspector field (partitions, replication factor,
  retention, payload size, capacity, rate) follows the exact local-state +
  inline-error pattern already used by `SimRoleFields` in `Inspector.tsx`
  (draft text state, validate on change, reject with a message and keep
  the last valid value, never silently clamp).
- **Rationale**: FR-002/SC-002 require zero silent clamping, and 008
  already built and battle-tested this exact interaction — reusing it is
  both the constitution's consistency preference (spec Assumptions:
  "reuse the interaction patterns established by 008") and the least code.
- **Alternatives considered**: a generic form-validation library (new
  dependency for a pattern the repo already owns).

## D7. Formula panel data shape and placement

- **Decision**: `FormulaPanel.tsx` is a new component mounted at the
  bottom of `Inspector.tsx`'s node branch (below the role/metrics fields),
  rendering `resolveFormulas(nodeId, latestWindow)`. Each entry shows name,
  expression (plain string, e.g. `"networkSaturation = (ingress + egress) /
  profile.networkGbps"`), current `inputs` as a small key/value list, a
  binding-highlight style when `binding === true`, and its `sources` as
  `<a target="_blank" rel="noopener noreferrer">` links. Empty state
  (no role, or 008 placeholder role) renders an explanatory sentence
  instead of an empty list, plus the standing disclaimer always renders,
  in every state.
- **Rationale**: directly implements FR-008/FR-009 and SC-004; `rel`
  attributes on the external links are an OWASP-relevant default (prevents
  `window.opener` reverse-tabnabbing) even though the spec doesn't spell
  out that detail.
- **Alternatives considered**: a modal/drawer instead of an always-visible
  sidebar section (spec fixes the location: "bottom of the right
  sidebar" is a user decision, not open for reinterpretation).

## D8. Testing strategy

- **Decision**: Vitest unit tests for every pure function (unit
  conversion, status/binding derivation incl. idempotency, the
  fixture-fallback resolver's precedence, and a fixture self-check that
  every regime has a non-empty `sources` array and a `status`/
  `bindingConstraint` pair that agree). Visual/layout concerns (badge
  legibility, panel scrolling, canvas status treatment appearance) are
  manual quickstart.md steps, matching 008's split (engine/pure logic
  tested, UI shell manually verified).
- **Rationale**: constitution Principle VI only mandates unit tests for
  pure logic, not component tests for the UI shell; this mirrors 008's
  already-accepted precedent exactly.
- **Alternatives considered**: React Testing Library component tests for
  Inspector/FormulaPanel (would be net-new test infrastructure the repo
  doesn't have yet — out of scope, no FR requires it).
