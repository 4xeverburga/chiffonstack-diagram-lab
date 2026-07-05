import { describe, expect, it } from 'vitest'
import { computeImageFit, FIT_MAX_SIDE, FIT_MIN_SIDE, heightForRatioLockedWidth } from '../../src/lab/imageFit'

describe('computeImageFit', () => {
  it('fits a square image to an equal-sided image area', () => {
    const fit = computeImageFit(500, 500, 20)
    expect(fit.aspect).toBe(1)
    const imageAreaHeight = fit.height - 20
    expect(fit.width).toBe(imageAreaHeight)
  })

  it('preserves a wide (3:1) ratio', () => {
    const fit = computeImageFit(900, 300, 20)
    expect(fit.aspect).toBe(3)
    const imageAreaHeight = fit.height - 20
    expect(fit.width / imageAreaHeight).toBeCloseTo(3, 4)
  })

  it('preserves a tall (1:3) ratio', () => {
    const fit = computeImageFit(300, 900, 20)
    expect(fit.aspect).toBeCloseTo(1 / 3, 4)
    const imageAreaHeight = fit.height - 20
    expect(fit.width / imageAreaHeight).toBeCloseTo(1 / 3, 4)
  })

  it('clamps an extremely wide (20:1) image without distorting it', () => {
    const fit = computeImageFit(2000, 100, 20)
    expect(fit.aspect).toBe(20)
    const imageAreaHeight = fit.height - 20
    expect(fit.width).toBeLessThanOrEqual(FIT_MAX_SIDE)
    expect(fit.width / imageAreaHeight).toBeCloseTo(20, 4)
  })

  it('clamps an extremely tall (1:20) image without distorting it', () => {
    const fit = computeImageFit(100, 2000, 20)
    expect(fit.aspect).toBeCloseTo(0.05, 4)
    const imageAreaHeight = fit.height - 20
    // The narrow axis (width) is what the box actually constrains here;
    // the derived height follows the ratio exactly, even past the box,
    // rather than ever distorting the image.
    expect(fit.width).toBeGreaterThanOrEqual(FIT_MIN_SIDE)
    expect(fit.width).toBeLessThanOrEqual(FIT_MAX_SIDE)
    expect(fit.width / imageAreaHeight).toBeCloseTo(0.05, 4)
  })

  it('scales a tiny (16x16) image up to at least the minimum side without distorting it', () => {
    const fit = computeImageFit(16, 16, 20)
    expect(fit.aspect).toBe(1)
    const imageAreaHeight = fit.height - 20
    expect(fit.width).toBeGreaterThanOrEqual(FIT_MIN_SIDE)
    expect(imageAreaHeight).toBeGreaterThanOrEqual(FIT_MIN_SIDE)
    expect(fit.width).toBe(imageAreaHeight)
  })

  it('adds the passed labelBand to the image-area height to form the node height', () => {
    const fitSmallBand = computeImageFit(400, 400, 18)
    const fitLargeBand = computeImageFit(400, 400, 24)
    expect(fitLargeBand.height - fitSmallBand.height).toBe(6)
  })
})

describe('heightForRatioLockedWidth', () => {
  it('derives height from width and aspect, then adds the label band', () => {
    expect(heightForRatioLockedWidth(200, 2, 20)).toBe(120)
  })

  it('keeps the ratio locked across a range of widths', () => {
    const aspect = 1.5
    for (const width of [80, 150, 300]) {
      const height = heightForRatioLockedWidth(width, aspect, 20)
      expect((height - 20) * aspect).toBeCloseTo(width, 6)
    }
  })
})
