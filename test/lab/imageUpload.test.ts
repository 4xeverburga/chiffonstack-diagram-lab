import { afterEach, describe, expect, it, vi } from 'vitest'
import { IMAGE_SIZE_WARNING_BYTES, IMAGE_UPLOAD_ACCEPT, readImageFile } from '../../src/lab/imageUpload'

// Vitest's default Node environment has neither createImageBitmap nor
// Image; stub the primary decode path so readImageFile's probing (spec
// 005, research.md R1) is exercised without a real browser. The actual
// decode path is a shell-edge concern covered by the manual round-trip
// gate (plan.md Testing).
function stubImageBitmap(width: number, height: number): void {
  vi.stubGlobal('createImageBitmap', async () => ({ width, height, close: () => {} }))
}

describe('imageUpload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts png, svg, and jpeg', () => {
    expect(IMAGE_UPLOAD_ACCEPT).toBe('image/png,image/svg+xml,image/jpeg')
  })

  it('sets the size warning threshold to 500,000 bytes', () => {
    expect(IMAGE_SIZE_WARNING_BYTES).toBe(500_000)
  })

  it('reads a file into a data URI and reports its byte size and natural dimensions', async () => {
    stubImageBitmap(4, 4)
    const bytes = new Uint8Array([1, 2, 3, 4])
    const file = new File([bytes], 'test.png', { type: 'image/png' })
    const result = await readImageFile(file)
    expect(result.byteSize).toBe(4)
    expect(result.dataUri.startsWith('data:image/png;base64,')).toBe(true)
    expect(result.naturalWidth).toBe(4)
    expect(result.naturalHeight).toBe(4)
  })

  it('reads a jpeg file', async () => {
    stubImageBitmap(200, 100)
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    const file = new File([bytes], 'test.jpg', { type: 'image/jpeg' })
    const result = await readImageFile(file)
    expect(result.dataUri.startsWith('data:image/jpeg;base64,')).toBe(true)
    expect(result.naturalWidth).toBe(200)
    expect(result.naturalHeight).toBe(100)
  })

  it('rejects when the environment cannot decode image dimensions', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const file = new File([bytes], 'test.png', { type: 'image/png' })
    await expect(readImageFile(file)).rejects.toThrow()
  })

  // Regression: some browsers' createImageBitmap rejects SVG blobs with
  // "InvalidStateError: The source image could not be decoded" even though
  // the function exists — probeNaturalSize must fall through to Image()
  // rather than propagating that rejection (previously it did not, so
  // every SVG upload failed in those browsers).
  it('falls back to Image() when createImageBitmap exists but rejects the file', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      async () => {
        throw new Error('InvalidStateError: The source image could not be decoded.')
      },
    )
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 32
      naturalHeight = 32
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', FakeImage)
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} })

    const bytes = new Uint8Array([1, 2, 3, 4])
    const file = new File([bytes], 'test.svg', { type: 'image/svg+xml' })
    const result = await readImageFile(file)
    expect(result.naturalWidth).toBe(32)
    expect(result.naturalHeight).toBe(32)
    expect(result.dataUri.startsWith('data:image/svg+xml;base64,')).toBe(true)
  })
})
