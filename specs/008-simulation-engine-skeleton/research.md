# Research: Simulation Engine Walking Skeleton

No NEEDS CLARIFICATION markers remained in the Technical Context; this
document records the decisions behind each technology/design choice.

## D1. Discrete-event engine design: event-driven loop with virtual clock

- **Decision**: classic DES — a binary-heap future-event list keyed by
  virtual time; the worker advances virtual time in sync with wall-clock
  (1× real time) by draining all events due within each 200 ms tick, then
  emitting one aggregated MetricsWindow.
- **Rationale**: exact queue dynamics (SC-003's 5% analytic tolerance is
  trivially met), naturally extensible to Kafka's state machines in 009,
  and the "drain due events per tick" shape means per-event cost stays in
  the worker — the UI cost is constant regardless of event rate
  (Principle V).
- **Alternatives considered**:
  - *Fluid/flow approximation (rates only, no discrete events)*: cheaper,
    but loses burst/variance behavior that makes congestion believable and
    that Kafka lag modeling needs; harder to extend to per-request effects.
  - *Fixed-timestep tick simulation*: simpler but accuracy couples to tick
    size; DES gives exactness for free at this scale.
  - *SIM.JS library*: unmaintained (last release ~2011, no types); the DES
    primitives we need (~200 lines) are cheaper to own and unit-test than
    to wrap — and Principle II wants every behavior auditable anyway.

## D2. High event rates: event-count guardrail, not per-event fidelity

- **Decision**: generator arrivals are sampled individually (exponential
  inter-arrivals) up to a cap of ~50,000 events per tick; above that the
  generator switches to batch arrivals (one event carrying `count = n`,
  with n drawn from Poisson via normal approximation). Queue/throughput
  math operates on counts, so results are identical in expectation.
- **Rationale**: SC-002 demands fluidity at ≥10,000 req/s; per-event
  objects at 10⁶ req/s would burn CPU for no observable difference once
  metrics are windowed. Counts keep the engine exact where it matters
  (aggregates) and bounded where it doesn't (object churn).
- **Alternatives considered**: unbounded per-event simulation (fails at
  extreme-rate edge case); always-batched (loses inter-arrival variance at
  low rates where users can actually see individual behavior).

## D3. Poisson sampling: inverse-transform with seedable PRNG

- **Decision**: inter-arrival times via `-ln(1-u)/λ` (inverse transform of
  the exponential); `u` from a small seedable PRNG (mulberry32, ~10 lines,
  public domain). Seed fixed in tests, random in production.
- **Rationale**: standard, exact, dependency-free; seedability makes engine
  tests deterministic (SC-005) without mocking `Math.random`.
- **Alternatives considered**: `Math.random` directly (non-reproducible
  tests); a stats library (new dependency for 10 lines — fails the
  constitution's dependency bar).

## D4. State management: Zustand with vanilla store + selector hooks

- **Decision**: one Zustand store (`src/sim/store.ts`) holding nodes,
  edges, run status, and the latest MetricsWindow. Created with
  `createStore` (vanilla) and wrapped by `useStore` hooks so the store
  itself stays testable without React. React Flow's controlled
  nodes/edges wire to store actions (the current `useDiagramMutations`
  logic moves in largely intact).
- **Rationale**: constitution mandates Zustand; vanilla-store-first keeps
  reducer logic unit-testable (Principle VI) and mirrors the
  ports-and-adapters posture.
- **Alternatives considered**: keep `useState` in App.tsx (contradicts
  constitution; metrics fan-out would force prop drilling); Redux Toolkit
  (heavier, no benefit at this scale).

## D5. Worker ↔ UI protocol: typed structured-clone messages, 200 ms windows

- **Decision**: plain structured-clone-able message objects defined in
  `src/sim/workerProtocol.ts` (discriminated unions): UI→worker
  `{init, start, pause, reset, updateTopology}`; worker→UI
  `{window: MetricsWindow}` every 200 ms plus `{status}` transitions.
  Metrics for all nodes/edges ride in one message per window.
- **Rationale**: one message per 200 ms regardless of event rate is the
  literal enforcement of Principle V. 200 ms sits inside the spec's
  100–500 ms assumption — fast enough to look continuous, slow enough to
  be negligible overhead. Structured clone suffices at ~50 nodes
  (payload ≈ a few KB); no need for SharedArrayBuffer (which would drag in
  COOP/COEP headers and complicate static hosting — Principle III).
- **Alternatives considered**: SharedArrayBuffer ring buffer (premature;
  hosting complications); Comlink (dependency for what two switch
  statements do); per-event postMessage (constitutionally forbidden).

## D6. Animation: throughput → CSS variables on HeatEdge, logistic mapping

- **Decision**: `sigmoidMapping.ts` exposes
  `mapThroughputToAnimation(throughput, params)` implementing
  V = V_min + (V_max − V_min)/(1 + e^(−k(log10(x) − x₀))) with fixed
  bounds: `animation-duration` clamped to [0.4 s, 6 s] (faster = more
  traffic) and dash density between sparse/dense presets. Applied
  per-edge as inline CSS variables (`--sim-flow-duration`,
  `--sim-flow-dash`) consumed by the existing `heat-flow` CSS animation.
  Log-scaled input so 10 req/s vs 1,000 req/s vs 100,000 req/s remain
  visually distinguishable.
- **Rationale**: reuses the shipped HeatEdge animation (user decision: no
  particles); bounded by construction (Principle V); CSS-variable writes
  don't re-render React components — React only re-renders when the
  200 ms window updates edge `data`, and even that is a single store
  update batched by React 19.
- **Alternatives considered**: React Flow's `animated` prop (binary, no
  speed control); requestAnimationFrame JS animation (busywork the CSS
  engine does for free); linear mapping (unbounded — violates
  Principle V).

## D7. Legacy export removal & JSON backward compatibility

- **Decision**: delete `ExportBar.tsx`, `exportSvg.ts`,
  `exportComponentCode.ts`, `exportBundle.ts`, `exportGeometry.ts`,
  `promptTemplate.ts`, `useExportActions.ts`; drop `fflate`. Keep
  `exportDiagram.ts` as the topology JSON serializer with its existing
  whitelist pattern, extended with the `sim` payload (role, config —
  never live metrics). A pre-pivot JSON fixture asserts old diagrams
  still parse (nodes get `sim: undefined` → plain diagram nodes).
- **Rationale**: constitution's Additional Constraints order the removal;
  the whitelist approach already in `exportDiagram.ts` is exactly the
  right mechanism for keeping transient metrics out of the JSON (FR-009).
- **Alternatives considered**: keeping the SVG export "because it works"
  (dead weight per constitution; every canvas change would drag it
  along).

## D8. Enforcing engine purity

- **Decision**: two mechanisms — (a) oxlint `no-restricted-imports`
  override scoped to `src/engine/**` banning `react`, `react-dom`,
  `@xyflow/react`, `zustand`, and relative imports escaping `src/engine/`;
  (b) engine unit tests run under Node (Vitest `environment: 'node'`), so
  any DOM/browser reference throws at test time.
- **Rationale**: Principle IV needs mechanical enforcement, not review
  vigilance; both mechanisms are zero-dependency and CI-visible.
- **Alternatives considered**: separate npm workspace package (real
  isolation but premature — revisit when a second consumer (CLI) exists);
  dependency-cruiser (new dev dependency; oxlint override suffices).
