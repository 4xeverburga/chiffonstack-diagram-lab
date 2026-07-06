
# Quickstart: Kafka Simulation UI

Manual smoke check for the implemented feature (complements the unit
suite; maps to the spec's four user stories). Runs entirely on the static
fixture — no engine changes, no feature 009 dependency.

## Setup

```bash
npm install
npm run dev
```

## Walkthrough (≈8 min)

1. **Configure a Kafka node (US1)**: add a node, open the Inspector,
   assign it the `kafka` role. *Expect*: hardware profile picker lists
   each profile with vCPU/RAM/network/disk specs visible; partitions,
   replication factor, TLS toggle, compression selector, retention are all
   present and editable. The node on the canvas still looks like an
   ordinary node (label + optional image only).
2. **Configure producer/consumer (US1)**: add two more nodes, assign
   `producer` (rate, avg payload size) and `consumer` (capacity). Enter an
   invalid value in each numeric field (e.g. payload size 0, negative
   rate, blank partitions). *Expect*: each is rejected inline with a
   specific message; the previous valid value stays in the field.
3. **Round-trip (US1/SC-002 precedent)**: export the topology JSON, reload
   the app, re-import it. *Expect*: every configured field (hardware
   profile, partitions, TLS, compression, retention, rate, payload size,
   capacity) reappears exactly as set.
4. **Import the regime fixture (US2/US3/US4)**: import
   `test/fixtures/kafka-demo-topology.json`. *Expect*: five kafka nodes
   appear, one per regime (healthy, network-saturated, cpu-saturated,
   disk-cliff, degraded).
5. **Read metrics per regime (US2)**: select each of the five nodes in
   turn. *Expect*: ingress/egress throughput, the three saturation
   meters, consumer lag, and page-cache hit ratio all render; the status
   badge reads healthy/saturated/degraded correctly per node; the binding
   constraint is visually distinguished and matches the regime (network
   meter for the network-saturated node, disk + dropped cache ratio for
   the disk-cliff node, etc.).
6. **Canvas status treatment (US3)**: without selecting anything, look at
   the canvas. *Expect*: only the saturated/degraded nodes carry a status
   treatment (border/badge from existing design tokens); it is visually
   distinct between the two states and doesn't rely on color alone; the
   healthy node looks like a plain node.
7. **Dual-unit edge (US3)**: connect a `producer` node (rate 1,000 req/s,
   avg payload 1 KB) to a `kafka` node. *Expect*: the edge shows both
   ~1,000 req/s and ~1 MB/s, mutually consistent.
8. **Formula & sources panel (US4)**: with each fixture node selected,
   scroll to the bottom of the Inspector. *Expect*: every active formula
   shows name, expression, current inputs, and ≥1 clickable source link
   (opens in a new tab); the binding-constraint highlight matches the
   metrics panel's; the standing directional-accuracy disclaimer is always
   present. Select a plain (no-role) node or an 008 placeholder processor.
   *Expect*: the panel explains why no formulas apply — never empty.
9. **Paused freeze (US2 edge case)**: with a live (non-fixture) simulation
   running on any 008 role, pause it. *Expect*: 008's existing frozen-value
   behavior is unaffected by the new panels.

## Automated checks

```bash
npm run lint    # includes src/engine purity rule (kafkaContracts.ts/hardwareProfiles.ts/unitConversion.ts must stay pure)
npm run test    # unit conversion, status-treatment idempotency, fixture-resolver precedence, fixture self-check, validation
npm run build
```
