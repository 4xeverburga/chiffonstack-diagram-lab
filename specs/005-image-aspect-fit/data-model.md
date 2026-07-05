# Data Model: Image Aspect Fit

## New pure module (`src/lab/imageFit.ts`)

```
computeImageFit(naturalWidth: number, naturalHeight: number, labelBand: number)
  → { width: number; height: number; aspect: number }
```

Constants (single home):
- `FIT_TARGET_WIDTH = 160` — preferred image-area width before clamping
- `FIT_MIN_SIDE = 64`, `FIT_MAX_SIDE = 360` — clamp bounds per image-area axis

Invariants:
- `aspect = naturalWidth / naturalHeight`, preserved exactly inside the
  clamp; at a clamp boundary, scale is limited but ratio is never broken.
- `height` includes the label band; the image area itself is
  `height - labelBand`.

## Plain node (canonical JSON) — extended

| Field | Type | Required | Notes |
|---|---|---|---|
| `data.image` | string (data URI) | no | unchanged (001 — embedded base64) |
| `data.imageAspect` | number | no | **NEW** — image natural aspect (w/h), rounded to 4 decimals; present iff written by an upload/replace after 005 |
| `width` / `height` | number | no | unchanged fields; now also written by the image fit (manual-size semantics) |

### Validation rules

- `parsePlainNode`: `imageAspect` kept only if a finite number > 0;
  otherwise dropped (node imports as a legacy image node). Never throws.
- `imageAspect` without `image` is meaningless — dropped on parse.
- No new required fields; pre-005 JSON imports byte-compatibly.

## Node states

| State | `image` | `imageAspect` | `width`/`height` | Resize behavior |
|---|---|---|---|---|
| Text-only, auto-sized | – | – | – | free resize |
| Text-only, manually sized | – | – | set | free resize |
| Legacy image node (pre-005 JSON) | set | – | maybe set | free resize (unchanged) |
| Image-fitted (005) | set | set | set by fit | ratio-locked: `height = width / aspect + labelBand` |

## State transitions

| Event | Effect |
|---|---|
| Image uploaded | `image` + `imageAspect` set; `width`/`height` ← `computeImageFit` (overrides any prior manual size) |
| Image replaced | Same as upload — re-fit to the new image |
| Image removed | `image`, `imageAspect`, `width`, `height` all cleared → auto-sizing |
| Manual resize of fitted node | `width` from drag; `height` derived from aspect + band; both persisted |
| Decode failure on upload | No state change; error surfaced (FR-008) |
| Label/text edits | No dimension change (dimensions are persisted, not content-derived) |

## Export consumption

Nothing new: all targets already honor persisted `width`/`height` via
`computeNodeBoxes`; `imageAspect` is carried in the JSON for the editor's
ratio lock and ignored by the visual exports.
