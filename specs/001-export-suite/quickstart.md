# Quickstart: Export Suite Development

## Dev loop

```bash
npm run dev        # Vite dev server — the editor
npm run lint       # oxlint (must stay clean, constitution IV)
npm run build      # tsc -b && vite build (merge gate)
npx vitest run     # generator unit tests (added in this feature)
```

Installing the new deps (`fflate`, `vitest`): check whether this repo deploys
via Cloudflare Pages before installing — if so, follow the npm-10 lock-file
regeneration rule from the landing repo's CLAUDE.md.

## Verifying each export (constitution round-trip gate)

Use the kitchen-sink fixture diagram (`test/lab/fixtures` — every node kind,
an image node, a resized node, every edge variant).

**P1 component export**

1. Export code, split into `Diagram.tsx` + `diagram.css`.
2. Drop into a scratch Vite React app with `@xyflow/react` installed
   (`npm create vite@latest scratch -- --template react-ts`).
3. Confirm: layout matches canvas, heat-flow animates, pan/zoom works, page
   scroll not hijacked, token colors/fonts applied.

**P2 bundle**

1. Download `diagram-bundle.zip`, unzip.
2. `diagram.json` → paste back into the editor → identical diagram.
3. Give the folder to a coding agent in the scratch app with only
   "integrate this diagram" → agent succeeds without questions (SC-003).

**P3 animated SVG**

1. Export `diagram.svg`.
2. Open directly in a browser **and** via `<img src="diagram.svg">` — animation
   plays in both; DevTools network tab shows zero requests.
3. Import into a design tool (or any non-animating host) — complete static
   frame, no missing edges.

**P4 image upload**

1. Attach a JPEG → renders on node → Export JSON → re-import → intact.
2. Attach a >500 KB image → non-blocking size warning appears at attach time.

## Where things live

- Generators (pure): `src/lab/exportComponentCode.ts`, `exportSvg.ts`,
  `exportBundle.ts`, `promptTemplate.ts`, shared math in `exportGeometry.ts`.
- UI wiring: `src/App.tsx` (lab-bar buttons + status labels),
  `src/lab/Inspector.tsx` (P4).
- Contracts these must satisfy: `specs/001-export-suite/contracts/`.
- Tests: `test/lab/*.test.ts` against the fixture diagram.
