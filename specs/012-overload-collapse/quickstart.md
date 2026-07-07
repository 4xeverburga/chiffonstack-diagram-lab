# Quickstart: 012 Overload Collapse Mode for Host Nodes

## Dev loop

```bash
npm install
npm run dev        # Vite dev server
npm run test       # Vitest — hostModel/flowPropagation/formulaCatalog collapse cases
npm run lint       # oxlint — must pass clean
npm run build      # tsc + vite build
```

## Watch a host collapse (User Story 1)

1. `npm run dev`. Select a `transactional_api`/`worker_consumer`/`database_server` host (manual mode). New hosts default to `collapse`.
2. Feed it via a `client_pool` at ~50% of `manualMaxRPS` — forwarded goodput ≈ offered, status `healthy`/`saturated` as usual.
3. Ramp the client pool to ~2× `manualMaxRPS` — watch forwarded goodput visibly *fall below its peak* (the retrograde region), latency keep climbing, `shedRPS` grow, status flip to `collapsed`. Node canvas treatment changes to the collapsed pattern (distinct from `overloaded`'s).
4. Ramp to ~5×+ — goodput approaches zero, stays finite and ≥ 0 (check the Inspector's live numbers, no NaN/Infinity).
5. Ramp back down below the knee — goodput recovers immediately along the same curve (no lag, no sticky failure state).

## Compare clamp vs collapse (User Story 2)

6. Create two identical hosts, one `clamp` one `collapse`; sweep the same offered-load range on both. Below the knee both report identical numbers; past it, `clamp` plateaus flat at its cap while `collapse` bends back down.
7. Confirm a freshly-assigned host defaults to `collapse`; confirm `client_pool`/`external_api` profiles show no overload-behavior control at all.
8. Import a diagram exported before this feature — every host behaves exactly as `clamp` (011/013 metrics unchanged).

## Downstream/upstream propagation (User Story 3)

9. Build `A (client_pool) → B (collapse host) → C`, plus a queue `Q → B` (so B receives from two paths — see research.md D4 for why a single-queue-only chain can't itself push a host past its knee). Push `A` well past `B`'s knee: confirm `C`'s incoming RPS tracks `B`'s collapsed goodput, and `Q`'s backlog growth accelerates as `B`'s acceptable throughput through the direct edge falls.

## Formula traceability (User Story 4)

10. Select a `collapse`-mode host mid-run; open the formula panel — the collapse/goodput formula appears with live inputs (`incomingRPS`, `kneeRPS`, `overloadRatio`) and at least one citation (receive-livelock / retrograde-throughput literature). A `clamp`-mode host shows no such descriptor (regression-safe formula set).

## Guardrails while implementing

- Exactly one new user-facing field: `overloadBehavior: 'clamp' | 'collapse'` on the two saturating-profile `configMode` variants only. Decay steepness (`HOST_COLLAPSE_DECAY_KAPPA`) and the collapsed-status goodput ratio (`HOST_COLLAPSE_STATUS_RATIO`) live in `src/engine/config.ts` — never user-facing.
- The constitution amendment (v3.3.0 → v3.4.0, Principle I) must land in this feature branch **before** the `ports.ts` change — the Constitution Check gate depends on it.
- `hostAcceptCapacityRPS` in `flowPropagation.ts` must NOT change (research.md D4) — if a diff touches that function, stop and re-check against FR-009.
- `clamp` mode must remain byte-identical to pre-012 output in every test that already exercises it (SC-003) — this includes the *formula descriptor set*, not just the numeric metrics.
- No default parameter values; root-relative imports; every new/extended `HostNodeSim` literal across `src/` **and** `test/` needs the new field (grep `configMode: 'manual'|configMode: 'calculated'` across both, per the 013 lesson in repo memory) — `test/**` is not type-checked by `tsc -b`, so a missed literal fails silently at runtime (`undefined` flowing into arithmetic) rather than at compile time; only `npx vitest run` actually exercises it.
