# Quickstart: Simulation Engine Walking Skeleton

Manual smoke check for the implemented feature (complements the unit
suite; maps to the spec's acceptance scenarios).

## Setup

```bash
npm install
npm run dev
```

## Walkthrough (≈5 min — SC-001)

1. **Build the topology**: add three nodes; in the Inspector assign roles:
   "Load Generator" (rate 100 req/s), "Placeholder Processor" (service
   rate 200 req/s), "Sink". Connect generator → processor → sink.
   *Expect*: nodes look like ordinary diagram nodes (label + optional
   image); the processor's Inspector section is labeled as a fixed-rate
   placeholder.
2. **Start (uncongested)**: press Start in the simulation controls.
   *Expect*: both edges animate; selecting the processor shows throughput
   ≈100 req/s and queue depth ≈0.
3. **Congest it**: raise the generator to 300 req/s.
   *Expect*: processor throughput plateaus ≈200 req/s; queue depth climbs
   steadily; the generator→processor edge animates visibly faster than
   the processor→sink edge.
4. **Pause / Reset**: pause — metrics and animation freeze; reset — all
   metrics zero, animation stops.
5. **Responsiveness (SC-002)**: set the generator to 1,000,000 req/s,
   start, then pan/zoom/drag nodes.
   *Expect*: no stutter; edge animation is fast but bounded (never a blur
   or a freeze); metrics render legibly.
6. **Round-trip (SC-004)**: copy topology JSON, reload the app, paste it.
   *Expect*: same topology, same configured rates, metrics at zero.
7. **Legacy import**: paste a pre-pivot diagram JSON
   (`test/fixtures/legacy-diagram.json`).
   *Expect*: loads as a plain diagram; roles assignable afterwards.
8. **Guard rails**: with no generator in the topology, press Start —
   clear message, nothing runs. Create a cycle and press Start — clear
   rejection naming the cycle. Delete the processor mid-run — simulation
   auto-pauses with a notice.

## Automated checks

```bash
npm run lint    # includes src/engine purity rule
npm run test    # engine determinism, queue math, sigmoid bounds, round-trip
npm run build
```
