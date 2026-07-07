# Product

## Product

**SUGAR** — an open-source interactive performance, capacity, and chaos
simulator for software architectures and data pipelines, by ChiffonStack.
A React Flow (`@xyflow/react`) canvas where engineers model topologies,
describe each host's capability with a few explicit parameters (a known
capability curve, or CPU time × worker threads), and watch the system breathe,
congest, scale, or collapse under load — driven by a discrete-event simulation
engine running entirely in the browser.

SUGAR pivoted from Diagram Lab (a static architecture-diagram editor whose
product was its exports). The canvas, edge flow animation, and design-token
styling carry over; the export pipeline does not.

## Users

Backend engineers, data architects, platform engineers (DevOps/SRE), and data
engineers. They are not looking for a pretty drawing tool; they need a local
"chaos sandbox" to predict backpressure bottlenecks, find which service
saturates first, and rightsize compute before paying for real cloud
infrastructure. They will distrust any number they
cannot audit — which is why every simulation formula is shown with its
sources in the Inspector.

## Product Purpose

SUGAR turns "will this architecture hold at 10× load?" into a five-minute
experiment. Success looks like: a user lays out a topology, describes each
host's capability (known capability curve, or CPU time × worker threads),
starts a synthetic traffic generator, and watches the canvas animate
throughput, backlog growth, and saturation — then drags a slider (request
rate, worker threads, payload size) and immediately sees where the system
breaks instead. Numbers are positioned as directionally correct for
comparing scenarios, never as guarantees.

## Simulation Model

- **Discrete-event engine, in-browser.** A pure-TypeScript core runs in a Web
  Worker behind explicit ports (topology in, traffic in, metrics out). The UI
  receives aggregated metric windows, never per-event messages.
- **Hosts first, lean parameters.** Compute hosts (client pools, APIs,
  workers, databases, external dependencies) are the deeply modeled
  components: saturation ratio, a smooth hockey-stick latency curve, and
  manual (known capability) vs calculated (CPU time × worker threads)
  configuration. Queues are deliberately generic zero-config buffers —
  throughput and backlog telemetry only. Saturating hosts also carry
  `minReplicas`/`maxReplicas` replica bounds, a `bootDelayMs` capability
  parameter, and `highWatermark`/`lowWatermark` saturation thresholds for
  horizontal autoscaling — an internal scaler adds/removes replicas
  proportionally to how far saturation sits past those thresholds (real
  Kubernetes HPA-style), with newly-added replicas taking the declared
  boot delay before serving traffic; the scaler's sustain window and
  cooldown timing stay internal tunables, not user parameters. Saturating
  hosts also carry an `overloadBehavior` switch (`clamp` | `collapse`,
  defaulting to `collapse` for new hosts): `clamp` plateaus at the host's
  cap the way every host always has; `collapse` bends goodput back down
  toward zero past that same cap — the retrograde "congestion collapse"
  curve real overloaded systems exhibit (connection-pool exhaustion, retry
  storms, GC/interrupt thrash) — derived entirely from the host's existing
  capability parameters plus an internal decay tunable, never a second
  knob. The user-facing parameter set is closed and small; new parameters
  require a constitution amendment.
- **One saturation dimension, honestly.** Saturation is a single
  resource-agnostic ratio, not split into CPU/memory/disk like k8s HPA's
  separate metrics. CPU time is already an estimate; memory pressure (GC
  pauses, working-set growth, OOM risk) would be a far shakier one, so SUGAR
  doesn't fabricate a second number it can't source. One honestly-approximate
  ρ beats two, one of which is guesswork.
- **Traceable formulas.** Every formula the engine applies is a named,
  unit-tested function carrying structured source metadata (vendor docs,
  papers, benchmarks). Selecting a node shows its active formulas and
  citations in the right-sidebar Inspector.
- **RPS ↔ MB/s edge converters.** Edges bridge transaction-oriented
  components (requests per second) and data components (megabytes per
  second) by multiplying RPS by a user-set average payload size.
- **Bounded animation.** No per-packet particles. Edge flow animation speed
  and density come from mapping throughput through a bounded sigmoid onto CSS
  variables, so render cost is independent of simulated event rate.

## Modes

- **Web / Playground (current scope)** — a 100% CSR app deployed at
  `sugar.kekeros.com`. Traffic comes from synthetic stochastic generators
  (Poisson, bursts). No backend, no accounts.
- **Local / Live Mock Server (deferred)** — a companion CLI / VS Code
  extension that opens a real local HTTP port so load tools like Locust can
  attack it while the canvas becomes a live telemetry dashboard. Explicitly
  out of scope until a constitution amendment brings it in; the engine's
  ports-and-adapters boundary exists so this (and a GitHub integration) can
  plug in later without touching the core.

## Open Source

The project is open source. That constrains how it's built:

- **Self-contained and static-hostable** — a Vite SPA with no backend, no
  accounts, no telemetry required to use it. Clone, install, run.
- **No proprietary format** — topology source is plain JSON with a small,
  documented shape; users own their models as text.
- **Contributor-legible** — small modules with one job each, pure engine
  logic fully unit-tested, conventions enforced in CLAUDE.md, lint via
  oxlint.

## Anti-references

- **Interview-prep toy simulators** — abstract components with made-up
  latency numbers and gamified scoring. SUGAR is a utilitarian tool: explicit
  user-owned capability parameters, sourced formulas, honest uncertainty.
- **Diagramming SaaS lock-in** (Lucidchart-style) — accounts, cloud storage,
  proprietary formats, paywalls. SUGAR's models are text you own.
- **Presentation animation tools** (Figma Motion, drawio animations) — motion
  for storytelling. SUGAR's animation is telemetry: it encodes simulated
  throughput and saturation, not narrative.
