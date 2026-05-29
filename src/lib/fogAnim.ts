/**
 * Animated drifting fog for the player view.
 *
 * The fog *shape* stays locked to the published data (the mask canvas). This only
 * animates the *look*: a warm dust base with two layers of slow-drifting fractal
 * noise blended in soft-light, so the fog billows and rolls like real mist. The
 * whole thing is masked to wherever fog remains, so revealed ground stays clear.
 *
 * Cheap enough for phones: a small tiling noise texture is baked once, then each
 * frame is just a few full-canvas pattern fills, throttled to ~30fps and paused
 * when the tab is hidden.
 */

const FOG_RGB = '74,63,49' // warm dust
const TILE = 256

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A seamless, tileable fractal-noise (fbm) texture — soft cloud shapes.
function makeNoiseTile(size: number, seed: number): HTMLCanvasElement {
  const rng = mulberry32(seed)
  const periods = [4, 8, 16, 32] // cells across the tile; all divide evenly → seamless
  const weights = [0.5, 0.25, 0.15, 0.1]
  const grids = periods.map((p) => {
    const g = new Float32Array(p * p)
    for (let i = 0; i < g.length; i++) g[i] = rng()
    return { p, g }
  })
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0
      for (let o = 0; o < periods.length; o++) {
        const { p, g } = grids[o]
        const fx = (x / size) * p
        const fy = (y / size) * p
        const ix = Math.floor(fx)
        const iy = Math.floor(fy)
        const x0 = ix % p
        const y0 = iy % p
        const x1 = (x0 + 1) % p
        const y1 = (y0 + 1) % p
        const tx = smooth(fx - ix)
        const ty = smooth(fy - iy)
        const top = g[y0 * p + x0] + (g[y0 * p + x1] - g[y0 * p + x0]) * tx
        const bot = g[y1 * p + x0] + (g[y1 * p + x1] - g[y1 * p + x0]) * tx
        v += (top + (bot - top) * ty) * weights[o]
      }
      const c = Math.max(0, Math.min(255, v * 255))
      const i = (y * size + x) * 4
      data[i] = data[i + 1] = data[i + 2] = c
      data[i + 3] = 255
    }
  }
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  cv.getContext('2d')!.putImageData(new ImageData(data, size, size), 0, 0)
  return cv
}

let sharedTile: HTMLCanvasElement | null = null
const tile = () => (sharedTile ??= makeNoiseTile(TILE, 1337))

export class FogHaze {
  private ax: CanvasRenderingContext2D | null = null
  private mask: HTMLCanvasElement | null = null
  private w = 0
  private h = 0
  private raf = 0
  private last = 0
  private running = false
  private tex = tile()

  /** Point the haze at a fresh anim canvas + fog mask (called on each publish). */
  configure(anim: HTMLCanvasElement, mask: HTMLCanvasElement, w: number, h: number) {
    this.ax = anim.getContext('2d')
    this.mask = mask
    this.w = w
    this.h = h
    if (!this.running) {
      this.running = true
      this.raf = requestAnimationFrame(this.tick)
    }
  }

  stop() {
    this.running = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private tick = (t: number) => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.tick)
    if (document.hidden) return
    if (t - this.last < 33) return // ~30fps
    this.last = t
    this.draw(t)
  }

  private layer(ax: CanvasRenderingContext2D, tx: number, ty: number, scale: number, alpha: number) {
    const pat = ax.createPattern(this.tex, 'repeat')
    if (!pat) return
    pat.setTransform(new DOMMatrix().translateSelf(tx, ty).scaleSelf(scale, scale))
    ax.globalCompositeOperation = 'soft-light'
    ax.globalAlpha = alpha
    ax.fillStyle = pat
    ax.fillRect(0, 0, this.w, this.h)
  }

  private draw(t: number) {
    const ax = this.ax
    const mask = this.mask
    if (!ax || !mask || !this.w) return
    ax.setTransform(1, 0, 0, 1, 0, 0)
    ax.globalCompositeOperation = 'source-over'
    ax.globalAlpha = 1
    ax.clearRect(0, 0, this.w, this.h)
    // warm dust base
    ax.fillStyle = `rgba(${FOG_RGB},0.72)`
    ax.fillRect(0, 0, this.w, this.h)
    // two slow drifting layers, opposite directions → rolling billows
    this.layer(ax, t * 0.010, t * 0.006, 4, 0.9)
    this.layer(ax, -t * 0.007, t * 0.009, 6.5, 0.7)
    // keep it only where fog remains
    ax.globalCompositeOperation = 'destination-in'
    ax.globalAlpha = 1
    ax.drawImage(mask, 0, 0, this.w, this.h)
    ax.globalCompositeOperation = 'source-over'
  }
}
