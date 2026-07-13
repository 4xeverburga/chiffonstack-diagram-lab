# SUGAR

[![CI](https://github.com/4xeverburga/chiffonstack-diagram-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/4xeverburga/chiffonstack-diagram-lab/actions/workflows/ci.yml)

**SUGAR** is an open-source, in-browser performance and capacity simulator
for software architectures, by [ChiffonStack](https://chiffonstack.com). Lay
out a system topology on a [React Flow](https://reactflow.dev) canvas —
client pools, hosts, queues, and the edges between them — describe each
host's capacity with a few explicit parameters, hit Start, and watch the
system breathe, congest, or collapse under load, all computed by a
discrete-event simulation engine running entirely client-side. No account,
no backend, no cloud infrastructure to spin up first.

SUGAR pivoted from **Diagram Lab**, a static architecture-diagram editor
whose product was its exports (SVG/React-component/agent-bundle). The
canvas, edge flow animation, and design-token styling carried over; the
export pipeline did not — only the round-trippable topology JSON
export/import remains.

## Why

"Will this architecture hold at 10x load?" is normally a question you can
only answer by provisioning real infrastructure and pointing a load
generator at it. SUGAR turns it into a five-minute experiment: sketch the
topology, describe each host's known capability (or its CPU time × worker
threads), start the simulation, and drag the traffic rate up until you see
exactly where — and why — it breaks. Every number is directionally correct
for comparing scenarios, never presented as a real-world guarantee, and
every formula the engine uses ships with its source citations in the
Inspector so you can audit it.

## Simulation model

- **Hosts** — the deeply modeled component. A saturation ratio (ρ) drives a
  smooth "hockey stick" latency curve (`latency = base × (1 + ρ/(1-ρ))`),
  configured either **manually** (a known baseline latency + saturation/max
  RPS) or **calculated** (CPU time per request × worker thread count).
  Profiles: client pool (traffic source), external API (bottomless), and
  transactional API / worker / database (the saturating kind).
- **Queues** — deliberately generic, zero-configuration buffers: throughput
  in/out and backlog telemetry only, no technology-specific parameters.
- **Edges** — carry the traffic-shaping configuration: share of upstream
  traffic (fan-out, including broadcast patterns where every edge gets
  100%), average payload size (for the RPS ↔ MB/s conversion), a
  compute-weight multiplier, and path I/O latency. Congested edges (feeding
  an overloaded host) render in red.
- **Traceable formulas.** Every metric the engine reports is backed by a
  named, unit-tested function with structured source citations (queueing
  theory, Little's law, operational analysis) — select any node or edge to
  see its live formula panel in the Inspector.
- **Discrete-event engine, in a Web Worker.** A pure-TypeScript core behind
  explicit ports (topology in, traffic in, metrics out) — the UI only ever
  receives aggregated per-window metrics, never per-event messages, so
  render cost stays flat regardless of simulated throughput.

See [PRODUCT.md](PRODUCT.md) for the full product scope and
[DESIGN.md](DESIGN.md) for the visual/brand system.

## Getting started

```bash
npm install
npm run dev      # start the app at http://localhost:5173
```

Other scripts:

```bash
npm run lint     # oxlint
npm run build    # tsc -b && vite build
npm test         # vitest run — engine formulas + UI unit tests
```

## Using the app

1. Drag a node kind in from the sidebar (or click one to drop it at the
   canvas center), then connect nodes to draw edges.
2. Select a node and assign it a simulation role in the Inspector: a
   **host** profile (client pool, external API, transactional API, worker,
   or database — manual or calculated capacity mode) or a **queue** (no
   configuration needed).
3. Select an edge to configure its traffic share, average payload size,
   compute-weight multiplier, and path I/O latency.
4. Hit **Start** in the header. Selecting any node or edge shows its live
   telemetry (incoming/forwarded rate, saturation, latency, shed traffic,
   backlog, active connections) and its sourced formulas in the Inspector.
5. Set your brand's design tokens in the sidebar — the canvas restyles
   live.
6. Use **Export JSON** / **Upload JSON** to save or reload a topology —
   the canonical, round-trippable diagram source.

## Project structure

```
src/
  App.tsx                  # canvas shell: React Flow wiring, node/edge state
  engine/                  # pure TS discrete-event simulation core (no
                            # React/DOM/xyflow/zustand imports — see
                            # CLAUDE.md and the constitution)
    ports.ts                 # the engine's hexagonal boundary (topology/
                              # traffic/metrics port shapes)
    hostModel.ts              # host saturation ratio + hockey-stick latency
    queueModel.ts              # queue inflow/outflow/backlog integration
    flowPropagation.ts          # per-window deterministic flow pass over
                                 # the topology
    formulaCatalog.ts            # sourced FormulaDescriptor builders
    simulation.ts                 # the DES loop (schedule/advance/emit)
    components.ts, eventQueue.ts, poisson.ts, sigmoidMapping.ts,
    flowAnimationSmoothing.ts, config.ts
  sim/                     # adapters between the engine and React
    workerProtocol.ts, simWorker.ts   # Web Worker host + message protocol
    store.ts, useSimulation.ts        # Zustand store + the React hook
  lab/                     # canvas/editor UI
    designTokens.ts          # the four-token brand contract
    nodeKinds.ts, heatVariants.ts, edgeStyle.ts
    hostConfigFields.tsx, edgeConfigFields.tsx  # Inspector config forms
    hostStatusTreatment.ts    # saturated/overloaded canvas treatment
    FormulaPanel.tsx           # sourced-formula readout
    exportDiagram.ts             # canonical diagram.json serialize/parse
    initialDiagram.ts             # starter topology
    Sidebar.tsx / Inspector.tsx / LabelNode.tsx / HeatEdge.tsx
test/engine/, test/lab/     # engine formula tests + UI unit tests/fixtures
specs/                      # spec-kit feature specs, plans, contracts, tasks
```

Engine logic stays pure and fully unit-tested under `test/engine/`; the
`sim/` adapters wire it to a Web Worker and a Zustand store; the UI layer
under `lab/` only ever reads windowed metrics and dispatches config changes.

## Contributing

See [CLAUDE.md](CLAUDE.md) for coding conventions (e.g. no default parameter
values, root-relative imports) and [PRODUCT.md](PRODUCT.md) for the
product's scope and anti-references. CI runs lint, build, and the test suite
on every push and pull request. `main` and `dev` are protected — PR feature
branches into `dev` first, then `dev` into `main`.

## License

This application (the SUGAR canvas UI, editor, and app code) is
**source-available** under the [Business Source License 1.1](LICENSE), not a
traditional open-source license. In short: you may read, modify, self-host,
and use it for internal, personal, educational, or evaluation purposes, but
you may **not** offer it to others as a competing hosted or commercial
diagramming product. Each released version converts to the Apache License 2.0
on its Change Date (see [LICENSE](LICENSE) for the exact terms). For commercial
licensing outside these terms, contact the Licensor.

The underlying simulation engine is a **separate**, MIT-licensed package —
[`sugar-skills`](https://github.com/4xeverburga/sugar) — and is not covered by
this license. The BSL applies only to this repository's application code.
