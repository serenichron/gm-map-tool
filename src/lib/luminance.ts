import { useEffect, useState } from 'react'

/**
 * Sample the average brightness of the map under a point, so pins can adapt to
 * the art beneath them (light border + label on dark ground, dark on light).
 *
 * The map is decoded once into a small offscreen canvas; queries map image-space
 * coordinates onto it. Returns 0–255 luminance, or null until ready / if the
 * image can't be read (e.g. cross-origin without CORS — we fail soft).
 */
export function useMapLuminance(src?: string): ((x: number, y: number) => number) | null {
  const [sampler, setSampler] = useState<((x: number, y: number) => number) | null>(null)

  useEffect(() => {
    if (!src) {
      setSampler(null)
      return
    }
    let alive = true
    const img = new Image()
    img.crossOrigin = 'anonymous' // needed to read pixels from storage URLs
    img.onload = () => {
      if (!alive) return
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      if (!nw || !nh) return
      const MAX = 220
      const ratio = nw / nh
      const w = ratio >= 1 ? MAX : Math.max(1, Math.round(MAX * ratio))
      const h = ratio >= 1 ? Math.max(1, Math.round(MAX / ratio)) : MAX
      const cv = document.createElement('canvas')
      cv.width = w
      cv.height = h
      const ctx = cv.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(img, 0, 0, w, h)
      let data: Uint8ClampedArray
      try {
        data = ctx.getImageData(0, 0, w, h).data
      } catch {
        setSampler(null) // tainted canvas → fail soft
        return
      }
      const fn = (x: number, y: number) => {
        const px = Math.max(0, Math.min(w - 1, Math.round((x / nw) * w)))
        const py = Math.max(0, Math.min(h - 1, Math.round((y / nh) * h)))
        const i = (py * w + px) * 4
        return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }
      setSampler(() => fn)
    }
    img.onerror = () => alive && setSampler(null)
    img.src = src
    return () => {
      alive = false
    }
  }, [src])

  return sampler
}
