# Quickstart: Layout Helpers

## What this feature does

A single canvas ergonomics helper, position-only (nothing new in the
exported JSON): alignment guides + a gentle snap while dragging a node
near another node's edges or center. No multi-selection, align, or
distribute actions — dropped from the original scope to avoid the
selection-related bug surface a bulk-action UI would add (see
`research.md` R0). No undo either — a snap is low-risk and immediately
fixable by dragging again (see R2).

## Try it

```bash
npm install
npm run dev
```

1. Drag a node near another node's left edge, center, or right edge —
   a guide line appears and the node gently snaps onto alignment; keep
   dragging past it and it releases; at rest, no guides show.
2. Hold `Alt` while dragging — no guides, no snap, the node follows the
   cursor exactly.
3. Drag a node near a differently-sized node (e.g. an image-fitted node
   from 005) — guides use its actual rendered edge, not a guessed size.
4. Export JSON after snapping a node — only `position` differs from
   before; re-import and the layout matches exactly. Component and SVG
   exports reflect the new position like any other move.
5. Try it with 50+ nodes on the canvas — dragging still feels immediate,
   no lag from guide computation.

## Verify (quality gates)

```bash
npm run lint
npm run build
npm test
```

Manual round-trip gate (constitution): drag a node to snap against a
mixed-size diagram (including an image-fitted node from 005) → export
JSON → re-import → visual parity; component and SVG exports match the
canvas.

## Key files

| File | Role |
|---|---|
| `src/lab/layout.ts` | Pure geometry: guide detection/snap (tested) |
| `src/lab/useLayoutHelpers.ts` | Imperative shell: drag wiring, modifier-key check |
| `src/lab/AlignmentGuides.tsx` | Flow-space guide-line overlay, rendered only while dragging near an alignment |
| `specs/006-layout-helpers/contracts/layout-helpers.md` | Pure-function contract |
