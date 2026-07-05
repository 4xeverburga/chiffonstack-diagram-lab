import { describe, expect, it } from 'vitest'
import { IMAGE_SIZE_WARNING_BYTES, IMAGE_UPLOAD_ACCEPT, readImageFile } from '../../src/lab/imageUpload'

describe('imageUpload', () => {
  it('accepts png, svg, and jpeg', () => {
    expect(IMAGE_UPLOAD_ACCEPT).toBe('image/png,image/svg+xml,image/jpeg')
  })

  it('sets the size warning threshold to 500,000 bytes', () => {
    expect(IMAGE_SIZE_WARNING_BYTES).toBe(500_000)
  })

  it('reads a file into a data URI and reports its byte size', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const file = new File([bytes], 'test.png', { type: 'image/png' })
    const result = await readImageFile(file)
    expect(result.byteSize).toBe(4)
    expect(result.dataUri.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('reads a jpeg file', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    const file = new File([bytes], 'test.jpg', { type: 'image/jpeg' })
    const result = await readImageFile(file)
    expect(result.dataUri.startsWith('data:image/jpeg;base64,')).toBe(true)
  })
})
