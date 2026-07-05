// Pure fit math for image-attached nodes: given an image's natural pixel
// dimensions, computes the node's fitted image-area box, clamped to sane
// bounds, preserving the image's aspect ratio exactly. See
// specs/005-image-aspect-fit/research.md R2 for the derivation.
export const FIT_TARGET_WIDTH = 160
export const FIT_MIN_SIDE = 64
export const FIT_MAX_SIDE = 360

export type ImageFit = { width: number; height: number; aspect: number }

// aspect = naturalWidth / naturalHeight, preserved exactly through the
// clamp. Image-area width starts at FIT_TARGET_WIDTH; whichever axis would
// first exceed [FIT_MIN_SIDE, FIT_MAX_SIDE] is clamped and the other axis
// is rescaled to keep the ratio exact — for very extreme ratios the
// rescaled axis may itself fall outside the range (unavoidable while
// keeping the ratio undistorted; the clamped axis still stays in bounds).
// `labelBand` is added to the clamped image-area height to produce the
// node's total height (the label strip below the image, per
// textSizes.ts). All arguments explicit — no default parameters.
export function computeImageFit(naturalWidth: number, naturalHeight: number, labelBand: number): ImageFit {
  const aspect = naturalWidth / naturalHeight
  let width = FIT_TARGET_WIDTH
  let imageHeight = width / aspect

  if (imageHeight > FIT_MAX_SIDE) {
    width *= FIT_MAX_SIDE / imageHeight
    imageHeight = FIT_MAX_SIDE
  } else if (imageHeight < FIT_MIN_SIDE) {
    width *= FIT_MIN_SIDE / imageHeight
    imageHeight = FIT_MIN_SIDE
  }

  if (width > FIT_MAX_SIDE) {
    imageHeight *= FIT_MAX_SIDE / width
    width = FIT_MAX_SIDE
  } else if (width < FIT_MIN_SIDE) {
    imageHeight *= FIT_MIN_SIDE / width
    width = FIT_MIN_SIDE
  }

  return {
    width: Math.round(width),
    height: Math.round(imageHeight + labelBand),
    aspect: Math.round(aspect * 10_000) / 10_000,
  }
}

// Derives a ratio-locked node height from a dragged width, for
// LabelNode.tsx's NodeResizer onResize handler (research.md R4):
// width-driven, so the image area's ratio stays exact at every size.
export function heightForRatioLockedWidth(width: number, aspect: number, labelBand: number): number {
  return width / aspect + labelBand
}
