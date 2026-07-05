// Closed vocabulary for node label text sizes (spec 004). All node text
// stays the body font at every step — there is no heading concept — so
// this module owns only the per-step font size and the sizing-heuristic
// constants (char width, node height, label band) that used to be
// hardcoded in exportGeometry.ts. The "normal" row is byte-identical to
// those old constants, so unchanged diagrams render exactly as before
// (FR-006, data-model.md).
export const TEXT_SIZES = ['small', 'normal', 'large'] as const
export type TextSize = (typeof TEXT_SIZES)[number]

export const DEFAULT_TEXT_SIZE: TextSize = 'normal'

export type TextSizeMetrics = {
  fontPx: number
  charWidth: number
  nodeHeight: number
  labelBand: number
}

export const TEXT_SIZE_METRICS: Record<TextSize, TextSizeMetrics> = {
  small: { fontPx: 11, charWidth: 6.5, nodeHeight: 36, labelBand: 18 },
  normal: { fontPx: 13, charWidth: 7.5, nodeHeight: 40, labelBand: 20 },
  large: { fontPx: 16, charWidth: 9.2, nodeHeight: 48, labelBand: 24 },
}

// Tolerant lookup used everywhere a size comes from untrusted input (parsed
// JSON) or from canvas node data: missing or unrecognized values fall back
// to the default rather than throwing (FR-006).
export function resolveTextSize(value: unknown): TextSize {
  return TEXT_SIZES.includes(value as TextSize) ? (value as TextSize) : DEFAULT_TEXT_SIZE
}
