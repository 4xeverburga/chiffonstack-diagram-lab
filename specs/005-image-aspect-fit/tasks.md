# Tasks: Image Aspect Fit

**Input**: Design documents from `/specs/005-image-aspect-fit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/image-fit.md

**Tests**: Included — the constitution mandates unit tests for all pure logic (fit math, serialization).

**Organization**: Tasks are grouped by user story. US1 (fit on upload), US2 (fixed/persistent size), US3 (ratio-locked resize), US4 (replace/remove lifecycle).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 Create feature branch `005-image-aspect-fit` from up-to-date `main`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure fit-math module every story's code depends on.

- [x] T002 Create `src/lab/imageFit.ts`: `FIT_TARGET_WIDTH = 160`, `FIT_MIN_SIDE = 64`, `FIT_MAX_SIDE = 360` constants; `computeImageFit(naturalWidth: number, naturalHeight: number, labelBand: number): { width: number; height: number; aspect: number }` — `aspect = naturalWidth / naturalHeight`; image-area width targets `FIT_TARGET_WIDTH`, then whichever image-area axis would first exceed `[FIT_MIN_SIDE, FIT_MAX_SIDE]` is clamped into range and the other axis is rescaled to keep `aspect` exact (for very extreme ratios the rescaled axis may itself fall outside the range — unavoidable while never distorting the image); returned `height` is the clamped image-area height plus `labelBand`; also export `heightForRatioLockedWidth(width, aspect, labelBand)` for the resize-time ratio lock (US3); all arguments explicit (no default parameters, per CLAUDE.md), per research.md R2
- [x] T003 [P] Create `test/lab/imageFit.test.ts`: square (1:1) image yields equal image-area width/height; wide (3:1) and tall (1:3) images preserve that ratio; an extreme wide (20:1) and extreme tall (1:20) ratio each keep the narrow axis within `[FIT_MIN_SIDE, FIT_MAX_SIDE]` and the ratio exact without distorting; a tiny image (16×16) scales up to at least `FIT_MIN_SIDE` without changing `aspect`; returned `height` always equals image-area height + the passed `labelBand`; `heightForRatioLockedWidth` derives height from width/aspect + labelBand and keeps the ratio exact across a range of widths

**Checkpoint**: `npm run lint && npm test` green; no behavior change yet (module unused).

---

## Phase 3: User Story 1 - Node Fits the Uploaded Image (Priority: P1) 🎯 MVP

**Goal**: Uploading an image to a node immediately resizes the node to match the image's aspect ratio, showing the full image undistorted with no cropping or bars.

**Independent Test**: Upload a square, a wide, and a tall image to three separate nodes and confirm each node adopts the matching aspect ratio and shows the full image undistorted.

- [x] T004 [US1] Extend `src/lab/imageUpload.ts`: `readImageFile` also probes natural dimensions via `createImageBitmap(file)`, falling back to an `Image()` + object-URL load when `createImageBitmap` is unavailable; add `naturalWidth`/`naturalHeight` to `ReadImageFileResult`; decode failure rejects the promise (caller already catches and logs — FR-008), per research.md R1
- [x] T005 [US1] Update `src/lab/useDiagramMutations.ts`: `setNodeImage(id, image, naturalWidth?, naturalHeight?)` — when `image` and both natural dimensions are provided, compute the node's current `labelSize`'s `labelBand` (via `resolveTextSize`/`TEXT_SIZE_METRICS` from `textSizes.ts`) and apply `computeImageFit` to set `data.imageAspect`, `width`, `height` on the node (overriding any prior manual size, per research.md R3/R5); when `image` is `undefined` (removal), clear `data.imageAspect` and delete `width`/`height` so the node returns to auto-sizing (FR-005)
- [x] T006 [US1] Update `src/lab/Inspector.tsx`'s `handleImageChange`: pass the probed `naturalWidth`/`naturalHeight` from `readImageFile`'s result through to `onSetNodeImage` so the upload path drives the fit end to end

**Checkpoint**: US1 fully functional — uploading a square/wide/tall image fits the node to that ratio immediately, full image visible with no cropping or bars.

---

## Phase 4: User Story 2 - Fitted Size Is Fixed and Persistent (Priority: P1)

**Goal**: A fitted node's dimensions behave like a manual resize: unaffected by text edits, and preserved exactly through JSON export/import and every export format.

**Independent Test**: Fit a node to an image, add text to it, export and re-import the JSON, and render the component-code and animated-SVG exports — confirming the node's dimensions are identical everywhere.

- [x] T007 [US2] Extend `src/lab/exportDiagram.ts`: `parsePlainNode` keeps `data.imageAspect` only if it is present, a finite number, and `> 0`, and only alongside a present `data.image` (otherwise dropped — node imports as a legacy image node, per research.md R6); `toPlainDiagram` serializes `data.imageAspect` from canvas state when present (omitted when absent, consistent with the existing `image`/`width`/`height` optionality)
- [x] T008 [P] [US2] Extend `test/lab/exportDiagram.test.ts`: round-trip preserves `imageAspect` alongside `width`/`height` for a fitted node; a legacy image node (no `imageAspect`) parses unchanged; a non-numeric/non-finite/`≤ 0` `imageAspect` is dropped on parse without affecting the rest of the node; `imageAspect` present without `data.image` is dropped
- [x] T009 [US2] Extend `test/lab/exportGeometry.test.ts`: a node with persisted `width`/`height` from an image fit is honored exactly by `computeNodeBoxes` regardless of `data.imageAspect` (regression on the existing manual-size path — no new geometry logic needed per plan.md, contracts/image-fit.md export-target obligations)

**Checkpoint**: US1 + US2 both work; JSON round-trips `imageAspect` exactly; component-code and SVG exports already reproduce fitted dimensions via the existing persisted-size path (no export-target code changes needed).

---

## Phase 5: User Story 3 - User Can Still Resize After the Fit (Priority: P2)

**Goal**: Manually resizing a fitted node preserves the image's aspect ratio at every size; nodes without an image keep today's free resize.

**Independent Test**: Fit a node to a 2:1 image, manually resize it smaller and larger, and confirm the node stays 2:1 and the image stays undistorted at every size.

- [x] T010 [US3] Update `src/lab/LabelNode.tsx`: when `data.imageAspect` is a present finite number, pass an `onResize` handler to `NodeResizer` that derives `height` via `heightForRatioLockedWidth(width, imageAspect, labelBand)` from `src/lab/imageFit.ts` (using the node's resolved `labelSize`'s `labelBand`) so the image area's ratio stays locked at every drag size (width-driven, per research.md R4); nodes without `data.imageAspect` keep the existing unconstrained `NodeResizer` behavior
- [x] T011 [P] [US3] Manually verify (quickstart.md step 3) that dragging a fitted node's resize handles keeps the image undistorted at every size; `heightForRatioLockedWidth`'s math is already unit-tested in T003, so this task is the manual/visual confirmation that `LabelNode.tsx` wires it correctly

**Checkpoint**: All three P1/P2 stories work; resizing a fitted node never distorts the image; non-image nodes resize freely as before.

---

## Phase 6: User Story 4 - Replacing or Removing the Image (Priority: P3)

**Goal**: Replacing a node's image re-fits it to the new image's ratio; removing the image returns the node to auto-sizing.

**Independent Test**: Replace a square image with a wide one and confirm the node re-fits; remove the image and confirm the node reverts to auto-sizing.

- [x] T012 [US4] Extend `test/lab/` coverage for `useDiagramMutations.setNodeImage` (or an equivalent focused unit test) confirming: replacing an existing fitted node's image with a new data URI + natural dimensions re-fits `width`/`height`/`imageAspect` to the new ratio; calling with `image = undefined` clears `data.imageAspect` and deletes `width`/`height` from the node

**Checkpoint**: Full image lifecycle covered — upload, replace, remove all behave per spec.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T013 Run full gates: `npm run lint`, `npm run build`, `npm test`; confirm every touched file stays under the constitution's ~250-line cap (`wc -l`)
- [x] T014 Manual round-trip gate per quickstart.md: upload square/wide/tall images and confirm fit + no distortion; resize a fitted node and confirm the ratio lock; replace and remove an image; export JSON → re-import parity; component export in a bare app; SVG opened directly and via `<img>` — fitted dimensions match the canvas everywhere; import a pre-005 diagram and confirm legacy image nodes render unchanged

---

## Dependencies & Execution Order

- **Phase 2 blocks everything**: T002 (module) → T003 (its tests); every later task depends on `imageFit.ts`.
- **US1 (Phase 3)**: needs T002 only. T004 (probing) before T005 (mutation, consumes the probed dimensions) before T006 (Inspector wiring).
- **US2 (Phase 4)**: needs T002 only — independent of Phase 3 (disjoint files: exportDiagram.ts/exportGeometry.ts vs. imageUpload.ts/useDiagramMutations.ts/Inspector.tsx). T007 before T008; T009 has no new production code (regression test only).
- **US3 (Phase 5)**: needs T002 (for the ratio-lock helper) and T005 (imageAspect must exist on nodes to resize against) — T010 before T011.
- **US4 (Phase 6)**: needs T005 (setNodeImage's fit/clear behavior) — T012 exercises it directly.
- **Polish**: last.

### Parallel Opportunities

- T003 has no sibling in Phase 2 to parallelize with (only foundational task).
- Phase 4 (export files) ∥ Phase 3 (upload/mutation/Inspector) — disjoint files once Phase 2 is done.
- T008 ∥ T009 (different test files) after T007 lands.
- T010 before T011 (T011 tests the helper T010's handler uses; can be authored alongside T002 and only wired into T010 as it's finished).

## Parallel Example: User Story 2

```bash
# After T007 lands, its tests are independent files:
Task: "Extend test/lab/exportDiagram.test.ts with imageAspect round-trip and drop cases"
Task: "Extend test/lab/exportGeometry.test.ts with a fitted-size regression case"
```

## Implementation Strategy

MVP = Phase 2 + Phase 3 (upload fits the node, full image undistorted). Then US2 (export/import fidelity) can proceed in parallel with US3 (ratio-locked resize) since they touch mostly disjoint files, but US3 needs T005 from Phase 3 first. Per Constitution I, **do not merge** before US1 + US2 are both done: a fit without matching export fidelity is incomplete. Single-developer order: T001→T003, then Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7.
