# Research: Image Aspect Fit

## R1 — Probing the image's natural dimensions

**Decision**: Extend `readImageFile` (in `imageUpload.ts`) to return
`naturalWidth`/`naturalHeight` alongside the data URI, using
`createImageBitmap(file)` and falling back to an `Image()` + object-URL
load where `createImageBitmap` is unavailable. Decoding failure rejects
the promise — the Inspector shows the error and leaves the node unchanged
(FR-008).

**Rationale**: The upload path is the imperative shell where the file is
already being read; both APIs are platform-native (Constitution III — no
dependency). SVG files without intrinsic dimensions report a rendered
default from the browser; whatever the browser reports is what the fit
uses — same source of truth as the eventual `<img>` render.

**Alternatives considered**: parsing image headers manually (PNG IHDR,
JPEG SOF) to keep it pure/testable — reimplements decoding for three
formats and still can't handle SVG intrinsic sizing; rejected. Probing
lazily at render time — the fit must happen at upload (SC-002), and render
time is too late to set persisted dimensions deterministically; rejected.

## R2 — The fit computation

**Decision**: New pure module `imageFit.ts`:

```
computeImageFit(naturalWidth, naturalHeight, labelBand) →
  { width, height, aspect }
```

- `aspect = naturalWidth / naturalHeight`.
- Image area targets `FIT_TARGET_WIDTH = 160` px wide, then clamps both
  axes into `[FIT_MIN_SIDE = 64, FIT_MAX_SIDE = 360]`, preserving `aspect`
  inside the clamp (the clamped axis wins, the other follows the ratio).
- Node `width` = fitted image width; node `height` = fitted image height
  + `labelBand` (the label strip below the image; value comes from
  `textSizes.ts` metrics once 004 lands, else the current 20px constant).
- All arguments explicit (no defaults, per CLAUDE.md).

**Rationale**: A 1:1 image yields a square image area (the spec's "1x1 →
node becomes 1x1" governs the image area; the label band is existing node
anatomy). Clamping bounds keep 20:1 banners and 16×16 icons usable
(spec edge cases) while never distorting — within the clamp the ratio is
exact; at the clamp boundary the ratio is preserved and only overall scale
is limited. Pure and unit-testable (Constitution IV).

**Alternatives considered**: fitting the *whole node box* to the image
ratio (label band included) — makes the visible image area letterboxed on
wide images, violating FR-001's "no empty bars"; rejected.

## R3 — Persisting the fit

**Decision**: Write the fitted dimensions to the node's `width`/`height` —
the existing manual-size fields — and store `data.imageAspect` (number,
`aspect` rounded to 4 decimals) beside `data.image`. A prior manual resize
is overwritten by the fit (upload is the newer intent, per spec edge case).

**Rationale**: `width`/`height` is the one path every consumer already
honors — `computeNodeBoxes`, the component export, the SVG export, and
re-import (FR-002 satisfied with zero new export logic). `imageAspect` is
persisted, rather than re-derived, because re-deriving on import would
require an async image decode inside the currently-pure `parseDiagram`;
one denormalized number is the cheaper trade (documented in the contract).

**Alternatives considered**: deriving aspect from persisted
width/height — conflated with the label band and broken the moment the
user resizes; rejected. Decoding on import — makes parsing async/impure;
rejected.

## R4 — Ratio-locked manual resize

**Decision**: When `data.imageAspect` is present, `LabelNode`'s
`NodeResizer` constrains resizes so the image area keeps the stored ratio:
`onResize` derives `height = width / imageAspect + labelBand` (width-driven;
corner/side handles all funnel through the same rule). Nodes without an
image keep today's free resize.

**Rationale**: React Flow's built-in `keepAspectRatio` locks the raw box
ratio, which drifts the image-area ratio as the fixed label band scales —
producing exactly the letterboxing FR-003 forbids; deriving height from
width in `onResize` keeps the invariant exact at every size. Width-driven
is unambiguous and matches how users think about scaling a captioned
image.

**Alternatives considered**: `keepAspectRatio` prop — approximate, drifts
with the band; rejected. Hiding the resizer on image nodes — spec US3
explicitly requires post-fit resizing; rejected.

## R5 — Replace and remove lifecycle

**Decision**: In `useDiagramMutations.setNodeImage`:
- **Set/replace**: store the data URI, store `imageAspect`, apply the
  computed fit to `width`/`height` (re-fit on every new image).
- **Remove**: clear `image` and `imageAspect`, delete `width`/`height` —
  the node returns to auto-sizing (FR-005).

**Rationale**: Matches spec US4 exactly. Clearing dimensions on remove is
correct even if the user had manually resized the fitted node — the sizes
were image-derived; reverting to auto-size is the documented behavior.

## R6 — Legacy and edge cases

**Decision**:
- Pre-005 JSON (image nodes without `imageAspect`): imports unchanged —
  image renders as today, no ratio lock, no auto-refit. Uploading a new
  image (or re-uploading the same one) opts the node in.
- Invalid `imageAspect` in hand-edited JSON (non-numeric, ≤ 0, or
  non-finite): dropped on parse; node imports as a legacy image node.
- Text longer than the fitted width: existing ellipsis treatment (the
  fitted width is a manual size, same truncation rule as 004/001).

**Rationale**: Never silently reshape a user's existing diagram on import
(round-trip promise); tolerant parsing is the house pattern.
