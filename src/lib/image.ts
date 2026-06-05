/**
 * Shrink an uploaded image to a small square-ish portrait and return it as a
 * WebP data URL. Kept tiny (~160px) so it can ride inside the pin JSON to
 * players without separate storage.
 */
export async function resizePortrait(file: Blob, max = 160): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('image load failed'))
      i.src = url
    })
    const iw = img.naturalWidth || max
    const ih = img.naturalHeight || max
    const scale = Math.min(1, max / Math.max(iw, ih))
    const w = Math.max(1, Math.round(iw * scale))
    const h = Math.max(1, Math.round(ih * scale))
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const ctx = cv.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
    return cv.toDataURL('image/webp', 0.8)
  } finally {
    URL.revokeObjectURL(url)
  }
}
