// Accept-list and read helper for node image uploads, shared by
// Inspector.tsx. Reads via Blob.arrayBuffer() + manual base64 encoding
// (rather than FileReader) so this is testable in Vitest's default Node
// environment as well as the browser.
export const IMAGE_UPLOAD_ACCEPT = 'image/png,image/svg+xml,image/jpeg'

// 500 KB pre-encoding ≈ 670 KB embedded in the diagram JSON — noticeable but
// not pathological in a shared JSON (research.md decision #9).
export const IMAGE_SIZE_WARNING_BYTES = 500_000

export type ReadImageFileResult = {
  dataUri: string
  byteSize: number
  naturalWidth: number
  naturalHeight: number
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// Probes the image's natural pixel dimensions so imageFit.ts can compute
// the fitted node size at upload time (spec 005, research.md R1).
// createImageBitmap is the primary path (available in browsers and in
// Vitest's jsdom/happy-dom-less default Node environment is not — tests
// stub this module, see imageUpload test doubles); Image() + an object URL
// is the fallback for environments without createImageBitmap. Rejects on
// decode failure — the caller (Inspector.tsx) surfaces the error and
// leaves the node unchanged (FR-008).
async function probeNaturalSize(file: File): Promise<{ naturalWidth: number; naturalHeight: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    const naturalWidth = bitmap.width
    const naturalHeight = bitmap.height
    bitmap.close?.()
    return { naturalWidth, naturalHeight }
  }
  if (typeof Image === 'function') {
    const objectUrl = URL.createObjectURL(file)
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve({ naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight })
        image.onerror = () => reject(new Error('Diagram Lab: could not decode image dimensions.'))
        image.src = objectUrl
      })
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }
  throw new Error('Diagram Lab: this environment cannot decode image dimensions.')
}

export async function readImageFile(file: File): Promise<ReadImageFileResult> {
  const buffer = await file.arrayBuffer()
  const base64 = arrayBufferToBase64(buffer)
  const mime = file.type || 'application/octet-stream'
  const { naturalWidth, naturalHeight } = await probeNaturalSize(file)
  return { dataUri: `data:${mime};base64,${base64}`, byteSize: file.size, naturalWidth, naturalHeight }
}
