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
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export async function readImageFile(file: File): Promise<ReadImageFileResult> {
  const buffer = await file.arrayBuffer()
  const base64 = arrayBufferToBase64(buffer)
  const mime = file.type || 'application/octet-stream'
  return { dataUri: `data:${mime};base64,${base64}`, byteSize: file.size }
}
