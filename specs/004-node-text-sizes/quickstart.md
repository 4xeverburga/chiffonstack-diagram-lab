# Quickstart: Node Text Sizes

## What this feature does

Node labels get a size step — small, normal, large — chosen from the
Inspector. All steps use the body font token (there is no header concept).
The size persists in the JSON and renders identically in the component-code
and SVG exports; auto-sized nodes grow to fit bigger text.

## Try it

```bash
npm install
npm run dev
```

1. Select a node — the Inspector shows Size chips: small / normal / large.
2. Set it to large — the label grows and the auto-sized node expands to
   fit, no clipping. Set small — both shrink.
3. Manually resize a node, then change its text size — the node keeps its
   dimensions; long text ellipsizes.
4. Export JSON, re-import — sizes restore exactly.
5. Export the component code and the SVG — relative text sizes match the
   canvas (check the SVG via `<img>` too).
6. Import a pre-004 `diagram.json` — loads clean, everything at normal.

## Verify (quality gates)

```bash
npm run lint
npm run build
npm test
```

Manual round-trip gate (constitution): export JSON → re-import → visual
parity; component export in a bare app + SVG direct and via `<img>` — text
sizing must match the canvas everywhere.

## Key files

| File | Role |
|---|---|
| `src/lab/textSizes.ts` | Size vocabulary + per-step metrics (font px, char width, node height, label band) — pure, tested |
| `src/lab/LabelNode.tsx` | Applies `node-label-<size>` |
| `src/lab/Inspector.tsx` | Size chips in the node pane |
| `src/lab/exportDiagram.ts` | Tolerant parse + serialization of `data.labelSize` |
| `src/lab/exportGeometry.ts` | Auto-size heuristic driven by the metric map |
| `src/lab/exportComponentCode.ts` / `exportSvg.ts` | Size classes + generated CSS rules |
| `specs/004-node-text-sizes/contracts/node-text-size.md` | JSON contract |
