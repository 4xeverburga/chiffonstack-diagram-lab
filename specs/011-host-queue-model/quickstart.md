# Quickstart: 011 Generalized Host/Queue Simulation Model

## Dev loop

```bash
npm install
npm run dev        # Vite dev server
npm run test       # Vitest (engine formulas, propagation, queue integration)
npm run lint       # oxlint — must pass clean
npm run build      # tsc + vite build
```

## P1 acceptance walkthrough (User Stories 1–2)

1. `npm run dev`, open the app. The starter diagram is client pool → API host → database host.
2. Select the client pool; set `requestRatePerSec` to 100. Start the simulation.
   - API host (capacity 500 req/s in the starter config) shows saturation ≈ 20%, latency ≈ baseline.
3. Raise the rate toward 480 req/s and watch latency climb smoothly (no jump at any threshold).
4. Push past 500 req/s: host status becomes overloaded, inbound edges render red (congested), and `shedRPS` appears in telemetry if `manualMaxRPS` is exceeded.
5. Switch the API host to calculated mode: `cpuProcessingTimeMs = 16`, `maxWorkerThreads = 8` (⇒ 500 req/s capacity). Verify the saturation point matches manual mode (SC-003).
6. Select the host and open the formula panel: saturation and latency formulas listed with live inputs and citations (SC-005).

## Queue check (User Story 3)

1. Insert a queue node between two hosts; give the producer side more MB/s than the consumer drains.
2. Watch `backlogGB` grow ≈ (inflow − outflow) × time; drop the producer rate and watch it drain to 0.

## Guardrails to respect while implementing

- Parameter set is **closed** (spec FR-020, constitution I) — do not add config fields.
- Every new formula: named pure function + unit test + sourced descriptor (constitution II/VI).
- All tunables in `src/engine/config.ts`; no default parameter values; root-relative imports (CLAUDE.md).
- Engine files import nothing from React/DOM/xyflow/Zustand (constitution IV).
- Delete, don't deprecate: `src/engine/kafka/*`, Kafka lab modules/tests, `KAFKA_*` constants.
