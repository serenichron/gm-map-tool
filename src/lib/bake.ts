/**
 * Bake a player-safe "veiled" map.
 *
 * Players used to receive the raw map image, so the full unrevealed terrain was
 * sittable in the browser's network tab. Instead, on publish we flatten the map
 * here on the GM's browser: revealed areas stay crisp, but hidden areas are
 * blurred and dimmed, so the real terrain is never present in the delivered
 * pixels — only the intended atmospheric hint. The player still layers the
 * animated haze + fog on top from the same fog ops, so it looks unchanged.
 *
 * Hint mode (chosen over "sealed"): we keep a faint, unreadable suggestion of
 * the ground rather than blanking it, matching the game's mood.
 */
import { FogController, type FogOp } from './fog.ts'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

/**
 * Blur `src` into `dst` (sized w×h) with the edge pixels stretched outward, so
 * the blur stays solid all the way to the margins instead of fading to nothing.
 */
function blurClamped(
  dst: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  w: number,
  h: number,
  blurPx: number,
  extraFilter = '',
) {
  const e = blurPx * 3 + 24
  dst.filter = `blur(${blurPx}px)${extraFilter ? ' ' + extraFilter : ''}`
  dst.drawImage(src, 0, 0, w, h)
  dst.drawImage(src, 0, 0, 1, sh, -e, 0, e, h) // left edge stretched left
  dst.drawImage(src, sw - 1, 0, 1, sh, w, 0, e, h) // right
  dst.drawImage(src, 0, 0, sw, 1, 0, -e, w, e) // top
  dst.drawImage(src, 0, sh - 1, sw, 1, 0, h, w, e) // bottom
  dst.filter = 'none'
}

export async function bakeVeiledMap(mapBlob: Blob, fogOps: FogOp[], w: number, h: number): Promise<Blob> {
  // load from the local blob (object URL) so the canvas isn't cross-origin tainted
  const url = URL.createObjectURL(mapBlob)
  try {
    const img = await loadImage(url)
    const iw = img.naturalWidth || w
    const ih = img.naturalHeight || h
    const min = Math.min(w, h)

    // the fog mask: opaque where players cannot see. Match the player's fog.
    const fog = document.createElement('canvas')
    fog.width = w
    fog.height = h
    const fc = new FogController()
    fc.hexClearScale = 1.2
    fc.hexClearShiftY = 0.15
    fc.attach(fog, w, h)
    fc.setOps(fogOps)

    // soften the mask (feather the crisp→veiled transition), clamped to margins
    const mask = document.createElement('canvas')
    mask.width = w
    mask.height = h
    blurClamped(mask.getContext('2d')!, fog, w, h, w, h, Math.max(14, Math.round(min * 0.025)))

    // a heavily blurred + dimmed copy of the map, clamped so it covers the
    // margins, kept only where the fog hides it
    const hidden = document.createElement('canvas')
    hidden.width = w
    hidden.height = h
    const hctx = hidden.getContext('2d')!
    blurClamped(hctx, img, iw, ih, w, h, Math.round(min * 0.08), 'brightness(0.6) saturate(0.85)')
    hctx.globalCompositeOperation = 'destination-in'
    hctx.drawImage(mask, 0, 0, w, h)
    hctx.globalCompositeOperation = 'source-over'

    // crisp map, then the veil painted over the hidden parts
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    const octx = out.getContext('2d')!
    octx.drawImage(img, 0, 0, w, h)
    octx.drawImage(hidden, 0, 0, w, h)

    return await new Promise<Blob>((resolve, reject) =>
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('bake failed'))), 'image/webp', 0.85),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
