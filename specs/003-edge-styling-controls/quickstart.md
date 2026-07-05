# Quickstart: Edge Styling Controls

## What this feature does

Edges get a thickness step (thin / normal / thick) and, for animated
heat-flow edges, a reversible animation direction. Selecting an edge shows
two floating quick-action buttons at its midpoint: cycle thickness and
reverse the flow. Both properties persist in the JSON and render identically
in the component-code and SVG exports.

## Try it

```bash
npm install
npm run dev
```

1. Select any edge — two small buttons appear at its midpoint (only the
   thickness button on non-heat-flow edges).
2. Click the thickness button repeatedly — the edge cycles
   thin → normal → thick and keeps the value after deselection.
3. Select the heat-flow edge and click reverse — the animation flows the
   other way; the edge stays attached to the same nodes and sides.
4. Check the Inspector — the same thickness chips and direction toggle are
   there and stay in sync.
5. Export JSON, re-import — thickness and direction restore exactly.
6. Export the component code and the SVG — edge weights and animation
   direction match the canvas (open the SVG via `<img>` too).
7. Import a pre-003 `diagram.json` — loads clean at normal/forward.

## Verify (quality gates)

```bash
npm run lint
npm run build
npm test
```

Manual round-trip gate (constitution): export JSON → re-import → visual
parity; component export in a bare app + SVG direct and via `<img>` —
thickness and flow direction must match the canvas everywhere.

Constitution IV check for this feature: `wc -l src/App.tsx` must be < 300
after the `useDiagramMutations` extraction.

## Key files

| File | Role |
|---|---|
| `src/lab/edgeStyle.ts` | Vocabularies, defaults, cycle order, stroke-width map (pure, tested) |
| `src/lab/EdgeToolbar.tsx` | Floating quick actions at the edge midpoint |
| `src/lab/HeatEdge.tsx` | Applies thickness/direction classes; mounts the toolbar when selected |
| `src/lab/useDiagramMutations.ts` | Node/edge mutation callbacks extracted from App.tsx |
| `src/lab/exportDiagram.ts` | Tolerant parse + whitelist of `data.thickness` / `data.direction` |
| `src/lab/exportComponentCode.ts` / `exportSvg.ts` | Class + CSS generation from the shared map |
| `specs/003-edge-styling-controls/contracts/edge-style.md` | JSON contract |
