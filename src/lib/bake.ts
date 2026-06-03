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

export async function bakeVeiledMap(mapBlob: Blob, fogOps: FogOp[], w: number, h: number): Promise<Blob> {
  // load from the local blob (object URL) so the canvas isn't cross-origin tainted
  const url = URL.createObjectURL(mapBlob)
  try {
    const img = await loadImage(url)

    // the fog mask: opaque where players cannot see. Match the player's fog.
    const fog = document.createElement('canvas')
    fog.width = w
    fog.height = h
    const fc = new FogController()
    fc.hexClearScale = 1.2
    fc.hexClearShiftY = 0.15
    fc.attach(fog, w, h)
    fc.setOps(fogOps)

    // soften the mask so the crisp→veiled transition feathers
    const blurR = Math.max(8, Math.round(Math.min(w, h) * 0.012))
    const mask = document.createElement('canvas')
    mask.width = w
    mask.height = h
    const mctx = mask.getContext('2d')!
    mctx.filter = `blur(${blurR}px)`
    mctx.drawImage(fog, 0, 0, w, h)
    mctx.filter = 'none'

    // a blurred + dimmed copy of the map, kept only where the fog hides it
    const hidden = document.createElement('canvas')
    hidden.width = w
    hidden.height = h
    const hctx = hidden.getContext('2d')!
    hctx.filter = `blur(${Math.round(Math.min(w, h) * 0.02)}px) brightness(0.6) saturate(0.85)`
    hctx.drawImage(img, 0, 0, w, h)
    hctx.filter = 'none'
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
