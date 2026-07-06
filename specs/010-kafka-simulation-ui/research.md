
# Research: Kafka Simulation UI

**Revised** after merging feature 009 (`009-kafka-simulation-model`) into
this branch. The original version of this document researched how to build
against a not-yet-existing contract; 009 now exists, so several of those
decisions (fixture-first architecture, an invented contract) are replaced
below with "consume the real thing" decisions. Kept: the idempotent
status-treatment pitfall note, the validation-pattern reuse, and the
formula-panel design — those hold regardless of where the data comes from.

## D1. Consume 009's real contract directly — no fixture, no resolver layer

- **Decision**: this feature reads `NodeMetrics.kafka`,
  `NodeMetrics.formulaDescriptors`, and `EdgeMetrics.nativeThroughputPerSec`/
  `.throughputMBps` directly through the existing `src/sim/store.ts`
  selectors (`selectNodeMetrics`, `selectEdgeMetrics`) that 008 already
  built and 009 already populates for Kafka-role nodes/edges. No new
  resolver module, no static fixture dataset.
- **Rationale**: the entire reason the original research proposed a
  fixture-then-live resolver was that 009 didn't exist yet at planning
  time. It now does (merged into this branch), computing real
  `KafkaNodeMetrics`/`FormulaDescriptor` values from real `SimRole` config
  via `src/engine/kafkaModel.ts`. Building a fixture layer now would be
  pure waste — an extra layer to maintain that duplicates what the real
  engine already does correctly (and unit-tests: see
  `test/engine/kafkaFormulas.test.ts`, `test/engine/kafkaSimulation.test.ts`).
- **Alternatives considered**: keep the fixture for UI-only unit/component
  tests even though live data exists (rejected — Vitest can construct a
  minimal `NodeMetrics`/`FormulaDescriptor` object inline per test, which is
  simpler than maintaining a shared fixture module for a handful of tests).

## D2. Hardware profile picker reads 009's real catalog, not an invented one

- **Decision**: the Inspector's Kafka hardware-profile picker iterates
  `Object.values(KAFKA_HARDWARE_PROFILES)` from `src/engine/kafkaCatalog.ts`
  (4 fixed AWS `m6i.*` entries: `vcpu`, `ramGiB`, `networkMBps`, `diskMBps`,
  each with per-field `sources`), storing only the chosen
  `hardwareProfile: KafkaHardwareProfileId` on the node's `SimRole`
  (matching the real field name — not `hardwareProfileId`).
- **Rationale**: 009 already built and sourced this catalog; inventing a
  parallel one (the original research's D3) would create two
  hardware-profile catalogs to keep in sync for no benefit.
- **Alternatives considered**: n/a — this is strictly "use what exists."

## D3. Dual-unit edges: read 009's already-computed values, no new conversion function

- **Decision**: `HeatEdge` (or its label) shows both units directly from
  `edge.data.simMetrics.nativeThroughputPerSec` (req/s) and
  `.throughputMBps` (MB/s) — both already computed by
  `kafkaModel.ts`'s `computeKafkaWindowMetrics` and merged onto edges by
  the existing `selectEdgeMetrics` call already wired in `App.tsx`'s
  `renderedEdges` `useMemo`. Displayed when both fields are present
  (`EdgeMetrics.nativeThroughputPerSec`/`.throughputMBps` are optional,
  populated only for producer/consumer↔kafka edges per 009's contract).
- **Rationale**: the original research (D5) planned a
  `convertReqPerSecToMBPerSec` utility because, at the time, no engine
  computed this. 009 already computes and ships both units per edge —
  building a second conversion path would risk disagreeing with the
  engine's own numbers.
- **Alternatives considered**: recomputing MB/s in the UI from a producer
  node's `averagePayloadBytes` (rejected — duplicates 009's math and could
  drift from it; reading the engine's own emitted value is the single
  source of truth).

## D4. Status badge & canvas treatment: token-derived, shape-redundant

- **Decision**: exactly three statuses (`healthy`/`saturated`/`degraded`,
  `NodeMetrics.kafka.status` — 009's real field). `healthy` applies no
  extra treatment. `saturated` and `degraded` each add one idempotent CSS
  class (derived only from the existing `--token-primary`/
  `--token-secondary` custom properties plus opacity/border-style, no new
  token) *and* a small text badge (not color-only), so both remain
  distinguishable under low-contrast user tokens (spec Edge Cases,
  accessibility fallback).
- **Rationale**: FR-006 forbids a new node visual component and forbids
  color-only signaling; reusing `--token-primary`/`--token-secondary` with
  different border-style/opacity per status plus a text badge satisfies
  both constraints without inventing anything.
- **Known pitfall to avoid (from prior 008-era bug, and the exact pattern
  the codebase already uses correctly)**: deriving a node's status
  className by appending to whatever `node.className` currently is, on the
  same node objects passed into `<ReactFlow nodes={...}>`, can bake the
  class in permanently — `useReactFlow().updateNode` spreads onto the
  *current* store node, so any later `updateNode` call (e.g. from
  `NodeResizer`) re-adopts a stale class. `src/lab/useHandleVisibility.ts`'s
  `withHandlesVisibleClass` already solves exactly this problem for the
  "handles-visible" class (strip the token, then reapply if needed, every
  render) — `kafkaStatusTreatment.ts` MUST follow that same pattern
  verbatim, and its call site belongs in the same `renderedNodes`
  `useMemo` in `App.tsx` that already calls `withHandlesVisibleClass`.
- **Alternatives considered**: a wrapper `<div>` around the node content
  (extra DOM layer, still needs the same idempotency care, no real
  benefit); driving status via inline style only (fails the
  not-color-alone requirement on its own — still needs the badge).

## D5. Binding-constraint agreement: derive it from `formulaDescriptors`, not a separate field

- **Decision**: 009's `KafkaNodeMetrics` has no `bindingConstraint` field —
  binding is expressed per-formula via `FormulaDescriptor.isBinding`
  (ids: `kafka.network.ingress-ceiling`, `kafka.cpu.ingress-ceiling`,
  `kafka.disk.ingress-ceiling`, `kafka.disk-cliff.threshold`,
  `kafka.disk-cliff.read-ceiling`). `src/lab/kafkaBindingResource.ts`
  exports a small pure function that scans a node's
  `formulaDescriptors` and returns `'network' | 'cpu' | 'disk' | undefined`:
  disk-cliff formulas being binding maps to `'disk'`; otherwise whichever
  of the three ingress-ceiling formulas has `isBinding: true` maps to its
  resource.
  Both the metrics panel's meter highlight and `FormulaPanel`'s
  highlighted row read this single function's output (plus each
  formula's own `isBinding` for its row), which is what makes FR-005's
  "always agree" true by construction rather than by coincidence.
- **Rationale**: this is the one place the real contract genuinely differs
  in shape (not just field names) from the original research's guess (D1
  there invented a top-level `bindingConstraint` enum). Deriving it from
  the real `formulaDescriptors` keeps this feature's UI-only scope intact
  — no engine change requested to add a field 009 didn't design in.
- **Alternatives considered**: asking 009 to add a `bindingConstraint`
  field to `KafkaNodeMetrics` (would require reopening 009's already-merged
  contract for a UI convenience; the derivation is a five-line pure
  function, cheaper and non-invasive).

## D6. Validation pattern: reuse 008's inline-reject, never-clamp shape

- **Decision**: every new Inspector field (partitions, replicationFactor,
  retentionBytes, `producer.messageRatePerSec`/`averagePayloadBytes`,
  `consumer.consumeRatePerSec`) follows the exact local-state +
  inline-error pattern already used by `SimRoleFields` in `Inspector.tsx`
  (draft text state, validate on change, reject with a message and keep
  the last valid value, never silently clamp). Validators live in
  `src/lab/kafkaRoleValidation.ts` as pure functions so SC-002's "validation
  test matrix" is a real unit-test file, not just manual QA.
- **Rationale**: FR-002/SC-002 require zero silent clamping, and 008
  already built and battle-tested this exact interaction — reusing it is
  both the constitution's consistency preference (spec Assumptions:
  "reuse the interaction patterns established by 008") and the least code.
  009's own validation rules (`partitions`/`replicationFactor` ≥ 1,
  `averagePayloadBytes` > 0 — see
  `specs/009-kafka-simulation-model/contracts/engine-kafka-ports.md` §1)
  are the source of truth for what each validator checks.
- **Alternatives considered**: a generic form-validation library (new
  dependency for a pattern the repo already owns).

## D7. Formula panel data shape and placement

- **Decision**: `FormulaPanel.tsx` is a new component mounted at the
  bottom of `Inspector.tsx`'s node branch (below the role/metrics fields),
  rendering `selectedNodeMetrics?.formulaDescriptors ?? []`. Each entry
  shows name, expression (real strings from `kafkaFormulas.ts`, e.g.
  `"networkIngressCeilingMBps = profile.networkMBps / replicationFactor"`),
  current `inputs` as a small key/value list, a binding highlight when
  `isBinding === true`, and its `sources` as
  `<a target="_blank" rel="noopener noreferrer">` links. Empty state
  (no role, or 008 placeholder processor role) renders an explanatory
  sentence instead of an empty list, plus the standing disclaimer always
  renders, in every state.
- **Rationale**: directly implements FR-008/FR-009 and SC-004; `rel`
  attributes on the external links are an OWASP-relevant default (prevents
  `window.opener` reverse-tabnabbing) even though the spec doesn't spell
  out that detail. 009 already guarantees non-empty `sources` at the
  engine level (`validateFormulaDescriptorsHaveSources` throws if any
  descriptor ships without one), so the panel can render `sources` without
  its own defensive fallback for that case.
- **Alternatives considered**: a modal/drawer instead of an always-visible
  sidebar section (spec fixes the location: "bottom of the right
  sidebar" is a user decision, not open for reinterpretation).

## D8. Testing strategy

- **Decision**: Vitest unit tests for every pure function this feature
  adds (role validators, status-treatment idempotency, the
  formulaDescriptors→binding-resource mapping, `FormulaPanel`'s pure
  view-model helper). Visual/layout concerns (badge legibility, panel
  scrolling, canvas status treatment appearance) are manual quickstart.md
  steps run against the real simulation (configure rates/profiles that
  drive each regime), matching 008's split (engine/pure logic tested, UI
  shell manually verified) — and no longer needing fixture data at all,
  since 009 is real.
- **Rationale**: constitution Principle VI only mandates unit tests for
  pure logic, not component tests for the UI shell; this mirrors 008's
  already-accepted precedent exactly. 009's own engine tests
  (`test/engine/kafkaFormulas.test.ts`, `kafkaSimulation.test.ts`) already
  cover the physics; this feature's tests only need to cover its own
  render-adjacent pure logic.
- **Alternatives considered**: React Testing Library component tests for
  Inspector/FormulaPanel (would be net-new test infrastructure the repo
  doesn't have yet — out of scope, no FR requires it).

