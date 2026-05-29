/**
 * Animated drifting fog for the player view.
 *
 * The fog *shape* stays locked to the published data (the mask canvas). This only
 * animates the *look*: warm dust whose density varies with fractal noise, so it
 * reads as wispy, translucent, drifting mist — thin gaps let the ground show
 * through, thicker billows roll across. Two layers drift in opposite directions
 * for movement; a faint constant haze keeps cleared-but-fogged ground hazy.
 *
 * The whole thing is masked to wherever fog remains. Cheap for phones: a high-res
 * tiling noise texture is baked once, then each frame is a few pattern fills,
 * throttled to ~30fps and paused when hidden.
 */

const DUST = '74,63,49' // warm dust
const TILE = 512

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Seamless tiling fbm, output as warm dust with a per-pixel alpha shaped into
// wisps (mostly thin, with denser veins) so the fog looks translucent and soft.
function makeNoiseTile(size: number, seed: number): HTMLCanvasElement {
  const rng = mulberry32(seed)
  // low frequencies weighted heavily → big rounded cloud masses, not fine veins
  const periods = [3, 6, 12, 24, 48] // all share factors with 512 → seamless
  const weights = [0.4, 0.27, 0.18, 0.1, 0.05]
  const grids = periods.map((p) => {
    const g = new Float32Array(p * p)
    for (let i = 0; i < g.length; i++) g[i] = rng()
    return { p, g }
  })
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const [dr, dg, db] = DUST.split(',').map(Number)
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
      // shape into soft-edged cloud masses: clear sky below the threshold,
      // rounded billows above it
      let a = (v - 0.45) / (0.72 - 0.45)
      a = a < 0 ? 0 : a > 1 ? 1 : a
      a = a * a * (3 - 2 * a)
      const i = (y * size + x) * 4
      data[i] = dr
      data[i + 1] = dg
      data[i + 2] = db
      data[i + 3] = Math.round(a * 255)
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
    ax.globalCompositeOperation = 'source-over'
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

    // constant base haze fills the gaps between clouds → less transparent overall
    ax.globalAlpha = 0.32
    ax.fillStyle = `rgba(${DUST},1)`
    ax.fillRect(0, 0, this.w, this.h)

    // slow-drifting cloud layers — opposite directions + a big slow roll, so the
    // forms evolve as they pass over each other
    this.layer(ax, t * 0.004, t * 0.0025, 2.2, 0.74)
    this.layer(ax, -t * 0.003, t * 0.004, 3.0, 0.6)
    this.layer(ax, t * 0.0015, -t * 0.0012, 4.6, 0.36)

    // keep it only where fog remains (mask already softened by the caller)
    ax.globalCompositeOperation = 'destination-in'
    ax.globalAlpha = 1
    ax.drawImage(mask, 0, 0, this.w, this.h)
    ax.globalCompositeOperation = 'source-over'
  }
}
