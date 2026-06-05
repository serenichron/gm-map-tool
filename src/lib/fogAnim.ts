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
  // weighted toward finer frequencies → smaller, more numerous cloud puffs
  const periods = [4, 8, 16, 32, 64] // all share factors with 512 → seamless
  const weights = [0.22, 0.24, 0.23, 0.18, 0.13]
  const grids = periods.map((p) => {
    const g = new Float32Array(p * p)
    for (let i = 0; i < g.length; i++) g[i] = rng()
    return { p, g }
  })
  const smooth = (t: number) => t * t * (3 - 2 * t)
  // white + per-pixel alpha (the cloud density); each layer is tinted from this
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
      // shape into cloud masses: a low threshold so most of the field is covered
      // (dense, not transparent) but with plenty of thickness variation = texture
      let a = (v - 0.32) / (0.7 - 0.32)
      a = a < 0 ? 0 : a > 1 ? 1 : a
      a = a * a * (3 - 2 * a)
      const i = (y * size + x) * 4
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
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

// tint the white+alpha noise tile to a colour (cheap; cached per colour)
function tintTile(base: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = base.width
  c.height = base.height
  const x = c.getContext('2d')!
  x.drawImage(base, 0, 0)
  x.globalCompositeOperation = 'source-in'
  x.fillStyle = color
  x.fillRect(0, 0, c.width, c.height)
  return c
}

// per-layer baseline drift, scale and opacity (speed multipliers applied live)
const LAYERS = [
  { tx: 0.009, ty: 0.006, scale: 1.25, alpha: 0.7 },
  { tx: -0.00675, ty: 0.009, scale: 1.8, alpha: 0.55 },
  { tx: 0.0036, ty: -0.00285, scale: 2.7, alpha: 0.34 },
]
const DEFAULT_COLORS = ['#5b4a35', '#46443a', '#352c22']

export class FogHaze {
  private ax: CanvasRenderingContext2D | null = null
  private mask: HTMLCanvasElement | null = null
  private w = 0
  private h = 0
  private raf = 0
  private last = 0
  private running = false
  private wasHidden = false
  private base = tile()
  private colors: string[] = [...DEFAULT_COLORS]
  private speeds: number[] = [1, 1, 1]
  private tints: HTMLCanvasElement[] = this.colors.map((c) => tintTile(this.base, c))
  /** called on the first painted frame after the tab/app returns from the
   *  background — the moment the canvas is live again, so static fog layers
   *  (which the OS may have wiped) can be repainted reliably. */
  onResume: (() => void) | null = null

  /** set per-layer colours + speed multipliers (re-tints only changed colours) */
  setStyle(colors: [string, string, string], speeds: [number, number, number]) {
    for (let i = 0; i < 3; i++) {
      if (colors[i] !== this.colors[i]) {
        this.colors[i] = colors[i]
        this.tints[i] = tintTile(this.base, colors[i])
      }
    }
    this.speeds = [speeds[0], speeds[1], speeds[2]]
  }

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
    if (document.hidden) {
      this.wasHidden = true
      return
    }
    // first live frame back from the background: repaint the static layers
    if (this.wasHidden) {
      this.wasHidden = false
      this.last = 0
      this.onResume?.()
    }
    if (t - this.last < 33) return // ~30fps
    this.last = t
    this.draw(t)
  }

  private layer(
    ax: CanvasRenderingContext2D,
    tex: HTMLCanvasElement,
    tx: number,
    ty: number,
    scale: number,
    alpha: number,
  ) {
    const pat = ax.createPattern(tex, 'repeat')
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

    // a constant dust haze so the hidden ground reads as fogged, not merely dim;
    // the drifting clouds add texture on top
    ax.globalAlpha = 0.24
    ax.fillStyle = `rgba(${DUST},1)`
    ax.fillRect(0, 0, this.w, this.h)

    // drifting cloud layers — each its own colour, direction, scale and speed
    for (let i = 0; i < LAYERS.length; i++) {
      const L = LAYERS[i]
      const sp = this.speeds[i] ?? 1
      this.layer(ax, this.tints[i], t * L.tx * sp, t * L.ty * sp, L.scale, L.alpha)
    }

    // keep it only where fog remains (mask already softened by the caller)
    ax.globalCompositeOperation = 'destination-in'
    ax.globalAlpha = 1
    ax.drawImage(mask, 0, 0, this.w, this.h)
    ax.globalCompositeOperation = 'source-over'
  }
}
