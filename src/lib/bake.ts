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
 * Blur `src` into `dst` (sized w×h) so the result stays fully opaque AND fully
 * diffused to the margins. A plain blur fades and under-averages at the edges
 * (where pixels have fewer neighbours), letting crisp detail survive. To avoid
 * that we paint the image into an oversized canvas and *mirror* its real terrain
 * outward into the margins, blur that, then crop the inner region — so every
 * edge pixel has genuine content on all sides to average against.
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
  const p = Math.ceil(blurPx) + 8 // margin ≥ blur radius
  const bw = w + 2 * p
  const bh = h + 2 * p
  const sw2 = Math.min(sw, Math.ceil((p * sw) / w)) // source px that map to a p-wide margin
  const sh2 = Math.min(sh, Math.ceil((p * sh) / h))

  // 1. image into the inner region, with the real terrain mirrored into the margins
  const ext = document.createElement('canvas')
  ext.width = bw
  ext.height = bh
  const e = ext.getContext('2d')!
  e.drawImage(src, 0, 0, sw, sh, p, p, w, h)
  // left + right (reflect across X)
  e.save()
  e.scale(-1, 1)
  e.drawImage(src, 0, 0, sw2, sh, -p, p, p, h)
  e.drawImage(src, sw - sw2, 0, sw2, sh, -bw, p, p, h)
  e.restore()
  // top + bottom (reflect across Y)
  e.save()
  e.scale(1, -1)
  e.drawImage(src, 0, 0, sw, sh2, p, -p, w, p)
  e.drawImage(src, 0, sh - sh2, sw, sh2, p, -bh, w, p)
  e.restore()
  // corners (reflect across both)
  e.save()
  e.scale(-1, -1)
  e.drawImage(src, 0, 0, sw2, sh2, -p, -p, p, p)
  e.drawImage(src, sw - sw2, 0, sw2, sh2, -bw, -p, p, p)
  e.drawImage(src, 0, sh - sh2, sw2, sh2, -p, -bh, p, p)
  e.drawImage(src, sw - sw2, sh - sh2, sw2, sh2, -bw, -bh, p, p)
  e.restore()

  // 2. blur the oversized canvas
  const blurred = document.createElement('canvas')
  blurred.width = bw
  blurred.height = bh
  const b = blurred.getContext('2d')!
  b.filter = `blur(${blurPx}px)${extraFilter ? ' ' + extraFilter : ''}`
  b.drawImage(ext, 0, 0)
  b.filter = 'none'

  // 3. crop the inner region (always fully opaque) into dst
  dst.drawImage(blurred, p, p, w, h, 0, 0, w, h)
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
    // Throw away resolution, not just detail: downscale the map to a tiny mosaic
    // then scale it back up smoothly. Anything smaller than a cell (markers,
    // buildings, even ridgelines) is averaged away — only broad colour masses
    // remain, so no feature is readable. (Blur alone keeps large silhouettes.)
    const tinyMax = 26
    const tw = Math.max(1, Math.round(iw >= ih ? tinyMax : tinyMax * (iw / ih)))
    const th = Math.max(1, Math.round(ih >= iw ? tinyMax : tinyMax * (ih / iw)))
    const tiny = document.createElement('canvas')
    tiny.width = tw
    tiny.height = th
    const tctx = tiny.getContext('2d')!
    tctx.filter = 'brightness(0.4) saturate(0.8)'
    tctx.drawImage(img, 0, 0, iw, ih, 0, 0, tw, th)
    tctx.filter = 'none'
    hctx.imageSmoothingEnabled = true
    hctx.imageSmoothingQuality = 'high'
    hctx.drawImage(tiny, 0, 0, tw, th, 0, 0, w, h)
    // a flat warm dust wash to settle it into the fog palette
    hctx.globalCompositeOperation = 'source-atop'
    hctx.fillStyle = 'rgba(38,32,24,0.45)'
    hctx.fillRect(0, 0, w, h)
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
