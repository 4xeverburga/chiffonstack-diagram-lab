# Data Model: Node Text Sizes

## New vocabulary (in `src/lab/textSizes.ts`)

```
TextSize = "small" | "normal" | "large"
```

- `const` array + derived type (house pattern); `DEFAULT_TEXT_SIZE = "normal"`.
- `TEXT_SIZE_METRICS: Record<TextSize, { fontPx: number; charWidth: number; nodeHeight: number; labelBand: number }>`
  — the only place these pixel values exist. The `normal` row equals
  today's hardcoded constants (13 / 7.5 / 40 / 20), so unchanged diagrams
  render byte-identically.

## Plain node (canonical JSON) — extended

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | unchanged |
| `type` | string | no (defaults `labelNode`) | unchanged |
| `position` | {x, y} | yes | unchanged |
| `data.label` | string | yes | unchanged |
| `data.image` | string (data URI) | no | unchanged |
| `data.labelSize` | TextSize | no | **NEW** — parse fallback `"normal"`; rendered with the body font token at every step |
| `className` | string | no | unchanged |
| `width` / `height` | number | no | unchanged (manual-size semantics) |

### Validation rules

- `parsePlainNode` never throws on a bad `labelSize`; missing or
  unrecognized → `"normal"` (FR-006).
- Re-export after import emits the explicit value (normalization,
  consistent with 002/003).

## Sizing semantics

| Node state | Effect of a size change |
|---|---|
| Auto-sized (no width/height) | Width/height recompute from `TEXT_SIZE_METRICS[size]` — node grows/shrinks to fit (FR-007) |
| Manually sized (width/height present) | Dimensions unchanged; label truncates with ellipsis if needed (controlled, never silent overflow) |
| With image | Label band height comes from the metric row; image area unchanged |

## Rendering contract (class names)

Per node label, every renderer derives:

```
node-label node-label-<size>
```

- Size classes set `font-size` only; `font-family` stays the base rule's
  `var(--token-body-font)` for all steps (FR-002).
- `normal` may render from the base rule (class present or omitted — the
  generated CSS decides; visual result identical).

## State transitions

| Event | Effect on data |
|---|---|
| Inspector size chip clicked | `data.labelSize` set to the chip value |
| Label content edited | `labelSize` untouched |
| Legacy JSON imported | Node gains explicit `labelSize: "normal"` in memory |
| JSON with unknown size imported | Falls back to `"normal"`; rest of node honored |
