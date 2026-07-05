# Quickstart: Node Connection Handles

## What this feature does

Every node gets four connection points (top, bottom, left, right), visible
only while you interact (hover, drag a connection, or select the node or a
connected edge). Edges remember which sides they attach to, in the editor
and in every export.

## Try it

```bash
npm install
npm run dev
```

1. Hover a node — four small points appear on its sides; move away — they
   vanish.
2. Drag from the bottom point of one node to the top point of another — the
   edge departs/arrives exactly there and stays put when you move the nodes.
3. Select the edge — both endpoint nodes show their points while selected.
4. Export JSON, re-import it — attachments are identical. Export the
   component code and the SVG — edges leave/enter on the same sides as the
   canvas, and no connection points are visible in either export.
5. Import a pre-feature `diagram.json` — it loads with the old right→left
   anchoring, unchanged.

## Verify (quality gates)

```bash
npm run lint
npm run build
npm test
```

Manual round-trip gate (constitution): export JSON → re-import → visual
parity; render the component export in a bare app and open the SVG both
directly and via `<img>` — edge anchoring must match the canvas everywhere.

## Key files

| File | Role |
|---|---|
| `src/lab/handleSides.ts` | Side vocabulary, legacy defaults, side→anchor/Position math (pure, tested) |
| `src/lab/LabelNode.tsx` | Renders the four handles |
| `src/lab/useHandleVisibility.ts` | Which nodes show handles, derived from selection |
| `src/lab/exportDiagram.ts` | Serialization + tolerant parsing of `sourceHandle`/`targetHandle` |
| `src/lab/exportGeometry.ts` | Side-aware edge paths shared by SVG + geometry consumers |
| `src/lab/exportComponentCode.ts` | Generated component with identical handles/anchoring |
| `specs/002-node-connection-handles/contracts/edge-attachments.md` | JSON contract |
