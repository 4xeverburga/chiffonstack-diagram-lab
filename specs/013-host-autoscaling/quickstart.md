# Quickstart: 013 Host Autoscaling / Replica Multiplier

## Dev loop

```bash
npm install
npm run dev        # Vite dev server
npm run test       # Vitest — autoscaler policy, replica math, projection rules
npm run lint       # oxlint — must pass clean
npm run build      # tsc + vite build
```

## Scale-out walkthrough (User Stories 1 & 4)

1. `npm run dev`. The starter API host ships with minReplicas 1 / maxReplicas 4 — it renders as a plain node at count 1.
2. Start the simulation; ramp the client pool well past the API's single-replica capacity.
3. Watch saturation sit above the high watermark for the sustain window → the host becomes a **scaling group**: a box appears with a second replica chip in *booting* (pending) treatment. Latency keeps climbing — capacity hasn't arrived yet.
4. When the boot delay elapses, the chip switches to serving, per-replica saturation and latency drop.
5. Keep ramping: chips stack vertically to 4. Set maxReplicas to 6 via the Inspector and overload further — the group shows 4 chips + "+2", the badge shows 6.
6. Check the Inspector: currentReplicaCount, per-replica saturation, and the scaling event list ("↑ 3 at t=12.4s"); the formula panel lists per-replica division and the scaling policy with citations.

## Scale-in walkthrough (User Story 2)

7. Drop the client rate to a trickle. Saturation sits below the low watermark; after the sustain window (and respecting the cooldown between steps) chips disappear one at a time down to minReplicas.

## Regression check (User Story 3)

8. Set minReplicas = maxReplicas = 1 on a host and re-run any 011 scenario — metrics and canvas must match pre-013 behavior exactly; no group box renders.

## Guardrails while implementing

- Exactly two new user-facing inputs (minReplicas, maxReplicas); everything else (watermarks 0.80/0.30, sustain, cooldown, boot delay, visible cap 4, event limit) lives in `src/engine/config.ts`.
- The constitution amendment (v3.0.0 → v3.1.0, Principle I) must land in this feature branch **before** the ports change — the Constitution Check gate depends on it.
- Replica chips/group containers: render-only — never in `SimTopology`, never serialized, never edge targets. Canvas node-list updates fire on scaling events only, never per metrics window (constitution V).
- Scaler policy is a pure function in `src/engine/autoscaler.ts` with exhaustive unit tests; no default parameter values; root-relative imports.
