
# Quickstart: Kafka Simulation UI

**Revised**: feature 009 is merged, so this walkthrough drives the real
engine (no fixture) — configure rates/profiles to reach each regime.

Manual smoke check for the implemented feature (complements the unit
suite; maps to the spec's four user stories).

## Setup

```bash
npm install
npm run dev
```

## Walkthrough (≈10 min)

1. **Configure a Kafka node (US1)**: add a node, open the Inspector,
   assign it the `kafka` role. *Expect*: hardware profile picker lists
   `m6i.large`/`m6i.xlarge`/`m6i.2xlarge`/`m6i.4xlarge` with vCPU/RAM/
   network/disk specs visible; partitions, replication factor, TLS
   toggle, compression selector (none/zstd), retention are all present
   and editable. The node on the canvas still looks like an ordinary
   node (label + optional image only).
2. **Configure producer/consumer (US1)**: add two more nodes, assign
   `producer` (message rate, avg payload size) and `consumer` (consume
   rate). Connect producer → kafka → consumer. Enter an invalid value in
   each numeric field (e.g. payload size 0, negative rate, blank
   partitions). *Expect*: each is rejected inline with a specific
   message; the previous valid value stays in the field.
3. **Round-trip (US1)**: export the topology JSON, reload the app,
   re-import it. *Expect*: every configured field (hardware profile,
   partitions, TLS, compression, retention, message rate, payload size,
   consume rate) reappears exactly as set.
4. **Healthy regime (US2)**: set producer rate × payload well under the
   chosen profile's network/CPU/disk limits (e.g. 1,000 msg/s × 1 KB on
   `m6i.xlarge`) and a consumer rate ≥ producer rate. Press Start.
   *Expect*: status badge reads healthy, ingress/egress throughput ≈
   offered load, all three saturation meters comfortably low, lag ≈ 0,
   page cache hit ratio ≈ 1.0.
5. **Saturate a wall (US2)**: raise the producer's payload size (or
   toggle TLS + zstd compression) until one saturation meter approaches
   1.0. *Expect*: status badge reads saturated; the metrics panel visibly
   distinguishes the binding meter (network, cpu, or disk, whichever hit
   its ceiling first) from the other two; throughput plateaus at the
   computed ceiling.
6. **Disk Cliff (US2)**: reduce the consumer's `consumeRatePerSec` well
   below the producer's rate (or pause the consumer node) and let lag
   grow past the profile's page-cache capacity. *Expect*: page cache hit
   ratio drops sharply, status badge reads degraded, consumer throughput
   collapses to the disk-bound ceiling — an abrupt transition, not a
   slope. Restore consumer capacity and confirm recovery back to healthy.
7. **Canvas status treatment (US3)**: without selecting anything, look at
   the canvas during steps 5–6. *Expect*: only the saturated/degraded
   Kafka node carries a status treatment (border/badge from existing
   design tokens); it is visually distinct between the two states and
   doesn't rely on color alone; a healthy node looks like a plain node.
8. **Dual-unit edge (US3)**: inspect the producer→kafka edge from step 4.
   *Expect*: the edge shows both the native msg/s rate and its MB/s
   equivalent, mutually consistent with the configured payload size
   (these come straight from the engine's own `nativeThroughputPerSec`/
   `throughputMBps` — no separate UI calculation to double check against
   anything other than itself for consistency).
9. **Formula & sources panel (US4)**: with the Kafka node selected in
   each of steps 4–6, scroll to the bottom of the Inspector. *Expect*:
   every active formula shows name, expression, current inputs, and ≥1
   clickable source link (opens in a new tab); the binding-constraint
   highlight matches the metrics panel's (network/cpu/disk ceiling
   formula while saturated, the disk-cliff formulas while degraded); the
   standing directional-accuracy disclaimer is always present. Select a
   plain (no-role) node or an 008 placeholder processor. *Expect*: the
   panel explains why no formulas apply — never empty.
10. **Paused freeze (US2 edge case)**: pause the running simulation.
    *Expect*: all Kafka metrics and the formula panel freeze at their
    last values, matching 008's existing frozen-value behavior for plain
    metrics.

## Automated checks

```bash
npm run lint    # oxlint — confirms no src/engine/ changes crept in
npm run test    # kafkaRoleValidation matrix, status-treatment idempotency, binding-resource derivation, plus 009's existing engine suite
npm run build
```

