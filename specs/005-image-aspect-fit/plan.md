# Implementation Plan: Image Aspect Fit

**Branch**: `main` (feature branch to be created at implementation) | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-image-aspect-fit/spec.md`

## Summary

When an image is attached to a node, probe its natural dimensions at upload
time (imperative shell, next to the existing base64 embedding in
`imageUpload.ts`), compute fitted node dimensions with a pure, clamped fit
function (new `imageFit.ts`), and persist them as the node's
`width`/`height` — the manual-size semantics every export target already
honors. The image's aspect ratio is stored as `data.imageAspect` so
subsequent manual resizes stay ratio-locked (image area, not raw box) and
imports don't need to re-decode the image. Replacing an image re-fits;
removing it clears the fit and returns the node to auto-sizing. No crop, no
edit — the image is used exactly as uploaded; extreme ratios and tiny
images are clamped without ever distorting.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19

**Primary Dependencies**: `@xyflow/react` (React Flow 12 — `NodeResizer` for ratio-locked resize); no new dependencies. Image probing via `createImageBitmap` with an `Image()` fallback — platform APIs only

**Storage**: Canonical diagram JSON (`exportDiagram.ts`); images remain embedded base64 data URIs (001)

**Testing**: Vitest unit tests for the pure fit math and serialization; probing lives at the shell edge (covered by the manual round-trip gate, per constitution)

**Target Platform**: Static Vite SPA; exports render in consumer React apps and plain `<img>` tags

**Project Type**: Single-page web app with functional-core export modules

**Performance Goals**: One decode per upload/replace; zero per-frame work; fit math is O(1)

**Constraints**: Backward-compatible JSON; deterministic exports; no image editing features; files under ~250 lines

**Scale/Scope**: ~5 source files touched, 1 new pure module, ~3 test files extended

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Evaluation | Status |
|---|---|---|
| I. Export Fidelity Is the Product | Fitted dimensions ride the existing persisted `width`/`height` path that `computeNodeBoxes` and all exports already honor — parity is inherited, not re-implemented. `data.imageAspect` round-trips; images stay embedded data URIs. | PASS |
| II. Minimal Design-Token Contract | No tokens, no styling surface — this is geometry, not style. | PASS |
| III. Open Source & Self-Contained | Platform APIs only; JSON gains one optional numeric field, documented. No image-editing scope creep (explicit non-goal). | PASS |
| IV. Contributor-Legible Codebase | Fit math (clamping, band handling, ratio) is a pure, unit-tested `imageFit.ts`; async decoding stays in `imageUpload.ts` at the shell edge. Upload/replace/remove flows go through `useDiagramMutations.ts` (003), not App.tsx (still over cap until 003 lands its extraction). | PASS |
| V. Export Targets & Portability | No new export logic: same canonical JSON, same geometry module. `imageAspect` is data all targets may read but none require. | PASS |

**Post-design re-check (Phase 1)**: PASS — one optional field; fit is a
projection onto existing manual-size semantics; no complexity entries.

## Project Structure

### Documentation (this feature)

```text
specs/005-image-aspect-fit/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── image-fit.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
└── lab/
    ├── imageFit.ts               # NEW — pure fit: (naturalW, naturalH, labelBand) → clamped {width, height, aspect}
    ├── imageUpload.ts            # readImageFile also probes natural dimensions (createImageBitmap → Image() fallback)
    ├── Inspector.tsx             # upload/replace/remove call the fit-aware mutations
    ├── useDiagramMutations.ts    # setNodeImage applies fit (set width/height/imageAspect) or clears them on remove
    ├── LabelNode.tsx             # NodeResizer ratio-locks the image area when data.imageAspect is present
    └── exportDiagram.ts          # parse/serialize data.imageAspect (optional number, tolerant)

test/lab/
├── imageFit.test.ts              # NEW — square/wide/tall, extreme-ratio clamp, tiny-image clamp, band math
├── exportDiagram.test.ts         # round-trip with/without imageAspect; invalid value dropped
└── exportGeometry.test.ts        # fitted width/height honored (existing manual-size path, regression)
```

**Structure Decision**: Existing single-project layout. The only genuinely
new logic — the fit computation — is pure and isolated in `imageFit.ts`;
everything else reuses the persisted-dimensions path 001 established and
the mutations hook 003 introduces.

## Complexity Tracking

No new violations. App.tsx overage (386 > 300) remains owned by plan 003's
extraction; this feature's mutation changes land in `useDiagramMutations.ts`.
