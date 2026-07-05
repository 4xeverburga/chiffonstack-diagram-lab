# Quickstart: Image Aspect Fit

## What this feature does

Uploading an image to a node makes the node adopt the image's aspect ratio
with fixed dimensions — a square logo gives a square image area, a wide
banner a wide one — clamped to sane bounds and never distorted. The fitted
size behaves like a manual resize (persisted, honored by every export),
later resizes stay ratio-locked, and removing the image returns the node
to auto-sizing. No cropping or editing — prepare images elsewhere.

## Try it

```bash
npm install
npm run dev
```

1. Select a node, upload a square (1:1) image — the node's image area
   becomes square, the image fills it edge to edge.
2. Upload a wide (3:1) image to another node — wide node, full image, no
   bars, no stretch.
3. Drag the fitted node's resize handles — it scales, but the ratio stays
   locked; the image never distorts.
4. Add text to the fitted node — dimensions don't change; long text
   ellipsizes.
5. Replace the image with a different ratio — the node re-fits. Remove the
   image — the node returns to auto-sizing.
6. Export JSON, re-import — dimensions and ratio lock restore exactly.
   Component and SVG exports match the canvas.
7. Try a 20:1 banner and a 16×16 icon — both clamp to usable sizes,
   undistorted. Import a pre-005 diagram — image nodes unchanged.

## Verify (quality gates)

```bash
npm run lint
npm run build
npm test
```

Manual round-trip gate (constitution): export JSON → re-import → visual
parity; component export in a bare app + SVG direct and via `<img>` —
fitted dimensions must match the canvas everywhere.

## Key files

| File | Role |
|---|---|
| `src/lab/imageFit.ts` | Pure fit math: target width, clamps, label band, aspect (tested) |
| `src/lab/imageUpload.ts` | Adds natural-dimension probing to the existing file read |
| `src/lab/useDiagramMutations.ts` | Fit-aware set/replace/remove image mutations |
| `src/lab/LabelNode.tsx` | Ratio-locked NodeResizer when `imageAspect` present |
| `src/lab/exportDiagram.ts` | Tolerant parse + serialization of `data.imageAspect` |
| `specs/005-image-aspect-fit/contracts/image-fit.md` | JSON contract |
