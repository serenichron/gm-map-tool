/**
 * Fog model and renderer.
 *
 * Fog is NOT a PNG (the prototype's mistake — too heavy to ship per update).
 * It is an ordered list of operations replayed onto a canvas:
 *   - a "fill" (cover all / reveal all), which resets the surface, and
 *   - a "stroke" (a feathered brush path), reveal / hide / semi.
 *
 * Replay is deterministic: every client that applies the same ops in order gets
 * byte-identical fog. The semi-reveal's torn strips are driven by a per-stroke
 * `seed` through a seeded PRNG (never Math.random at draw time), so the tears
 * reproduce exactly on every player's screen — the thing the prototype could
 * only achieve by shipping the rendered PNG.
 *
 * Undo/redo is a cursor into the op list. The op list is also exactly what gets
 * published to players in milestone 5.
 */

import { hexCenter, hexVertices, type HexCell } from './hex.ts'

export const FOG_COLOR = [74, 63, 49] as const // warm dust, never grey

export type FogTool = 'reveal' | 'hide' | 'semi'
export type Pt = { x: number; y: number }

export type FogStroke = {
  kind: 'stroke'
  tool: FogTool
  radius: number // image-space radius
  seed: number // drives the semi shred pattern; present (unused) on reveal/hide too
  points: Pt[] // image-space path
}
export type FogFill = { kind: 'fill'; value: 'covered' | 'clear' }
/** Whole hex tiles cleared / covered / partially torn, applied in one batch
 *  (one undo). Each client renders the same cells from col/row/size. */
export type FogHexes = {
  kind: 'hexes'
  tool: FogTool
  size: number
  seed: number
  cells: HexCell[]
}
export type FogOp = FogStroke | FogFill | FogHexes

const SHRED_TILE = 200

/** Small fast seeded PRNG. Identical output for identical seed on every engine. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Centres to stamp along a brush path, spaced by `overlap` × radius. */
function stampCenters(points: Pt[], r: number, overlap: number): Pt[] {
  if (points.length === 0) return []
  if (points.length === 1) return [points[0]]
  const step = Math.max(1, r * overlap)
  const out: Pt[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const n = Math.max(1, Math.floor(Math.hypot(dx, dy) / step))
    for (let j = 0; j < n; j++) {
      const t = j / n
      out.push({ x: a.x + dx * t, y: a.y + dy * t })
    }
  }
  out.push(points[points.length - 1])
  return out
}

export class FogController {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private w = 0
  private h = 0

  ops: FogOp[] = []
  /** Scale tile clears around their centre. 1 = exactly the hex (GM); the player
   *  sets >1 so the clear bleeds a little past the tile edge. */
  hexClearScale = 1
  private cursor = 0 // number of ops currently applied (0..ops.length)

  private before: HTMLCanvasElement = document.createElement('canvas') // snapshot during active stroke
  private scratch: HTMLCanvasElement = document.createElement('canvas') // semi masking buffer
  private current: FogStroke | null = null
  private currentHex: FogHexes | null = null
  private shredCache = new Map<number, HTMLCanvasElement>()

  attach(canvas: HTMLCanvasElement, w: number, h: number) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.w = w
    this.h = h
    this.before.width = w
    this.before.height = h
  }

  /** Replace the op list wholesale (player replay / loading a saved state). */
  setOps(ops: FogOp[]) {
    this.ops = ops.slice()
    this.cursor = this.ops.length
    this.render()
  }

  /** Start fresh: one base fill, fully covered or fully clear. */
  reset(base: 'covered' | 'clear' = 'covered') {
    this.ops = [{ kind: 'fill', value: base }]
    this.cursor = 1
    this.render()
  }

  /** The ops currently in effect (excludes any undone "redo tail"). This is what
   *  gets saved locally and, in milestone 5, published to players. */
  getActiveOps(): FogOp[] {
    return this.ops.slice(0, this.cursor)
  }

  canUndo() {
    return this.cursor > 0
  }
  canRedo() {
    return this.cursor < this.ops.length
  }

  undo() {
    if (!this.canUndo()) return
    this.cursor--
    this.render()
  }
  redo() {
    if (!this.canRedo()) return
    this.cursor++
    this.render()
  }

  fill(value: 'covered' | 'clear') {
    this.commit({ kind: 'fill', value })
    this.applyOp({ kind: 'fill', value })
  }

  // ---- active stroke (GM painting) ----

  beginStroke(tool: FogTool, radius: number, seed: number) {
    if (!this.ctx) return
    // snapshot current fog so each move can redraw the whole stroke once
    // (keeps the live view identical to a fresh replay — important for semi)
    const bctx = this.before.getContext('2d')!
    bctx.clearRect(0, 0, this.w, this.h)
    bctx.drawImage(this.canvas!, 0, 0)
    this.current = { kind: 'stroke', tool, radius, seed, points: [] }
  }

  extendStroke(x: number, y: number) {
    if (!this.current || !this.ctx) return
    this.current.points.push({ x, y })
    // restore pre-stroke fog, then re-carve the full path once
    this.ctx.clearRect(0, 0, this.w, this.h)
    this.ctx.drawImage(this.before, 0, 0)
    this.applyStroke(this.current)
  }

  endStroke() {
    if (!this.current) return
    if (this.current.points.length > 0) {
      // canvas already shows the result; just record the op
      this.ops.length = this.cursor
      this.ops.push(this.current)
      this.cursor++
    }
    this.current = null
  }

  // ---- active hex-tile batch (one click/drag = one undo) ----

  beginHexBatch(tool: FogTool, size: number, seed: number) {
    if (!this.ctx) return
    const bctx = this.before.getContext('2d')!
    bctx.clearRect(0, 0, this.w, this.h)
    bctx.drawImage(this.canvas!, 0, 0)
    this.currentHex = { kind: 'hexes', tool, size, seed, cells: [] }
  }

  addHexCell(col: number, row: number) {
    if (!this.currentHex || !this.ctx) return
    if (this.currentHex.cells.some((c) => c.col === col && c.row === row)) return
    this.currentHex.cells.push({ col, row })
    this.ctx.clearRect(0, 0, this.w, this.h)
    this.ctx.drawImage(this.before, 0, 0)
    this.applyHexes(this.currentHex)
  }

  endHexBatch() {
    if (!this.currentHex) return
    if (this.currentHex.cells.length > 0) {
      this.ops.length = this.cursor
      this.ops.push(this.currentHex)
      this.cursor++
    }
    this.currentHex = null
  }

  // ---- rendering ----

  private commit(op: FogOp) {
    this.ops.length = this.cursor // drop any redo tail
    this.ops.push(op)
    this.cursor++
  }

  render() {
    if (!this.ctx) return
    this.ctx.clearRect(0, 0, this.w, this.h)
    for (let i = 0; i < this.cursor; i++) this.applyOp(this.ops[i])
  }

  private applyOp(op: FogOp) {
    if (op.kind === 'fill') {
      const ctx = this.ctx!
      ctx.globalCompositeOperation = 'source-over'
      if (op.value === 'covered') {
        ctx.fillStyle = `rgba(${FOG_COLOR[0]},${FOG_COLOR[1]},${FOG_COLOR[2]},1)`
        ctx.fillRect(0, 0, this.w, this.h)
      } else {
        ctx.clearRect(0, 0, this.w, this.h)
      }
    } else if (op.kind === 'hexes') {
      this.applyHexes(op)
    } else {
      this.applyStroke(op)
    }
  }

  private applyHexes(op: FogHexes) {
    for (const cell of op.cells) this.applyHexCell(op.tool, cell.col, cell.row, op.size, op.seed)
  }

  private applyHexCell(tool: FogTool, col: number, row: number, size: number, seed: number) {
    const ctx = this.ctx!
    const { x, y } = hexCenter(col, row, size)
    const rs = size * this.hexClearScale // clear radius (may bleed past the tile)
    const verts = hexVertices(x, y, rs)
    ctx.save()
    ctx.beginPath()
    verts.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)))
    ctx.closePath()
    if (tool === 'reveal') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.fill()
    } else if (tool === 'hide') {
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = `rgba(${FOG_COLOR[0]},${FOG_COLOR[1]},${FOG_COLOR[2]},1)`
      ctx.fill()
    } else {
      // semi: torn shred clipped to the hex, anchored to image space (deterministic)
      ctx.clip()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.globalAlpha = 0.9
      const pat = ctx.createPattern(this.getShred(seed), 'repeat')!
      pat.setTransform(new DOMMatrix())
      ctx.fillStyle = pat
      ctx.fillRect(x - rs, y - rs, rs * 2, rs * 2)
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  private applyStroke(stroke: FogStroke) {
    if (stroke.tool === 'semi') this.applySemi(stroke)
    else this.applyBasic(stroke)
  }

  private applyBasic(stroke: FogStroke) {
    const ctx = this.ctx!
    const r = stroke.radius
    const stamps = stampCenters(stroke.points, r, 0.4)
    ctx.save()
    if (stroke.tool === 'reveal') {
      ctx.globalCompositeOperation = 'destination-out'
      for (const p of stamps) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
        g.addColorStop(0, 'rgba(0,0,0,1)')
        g.addColorStop(0.45, 'rgba(0,0,0,1)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      ctx.globalCompositeOperation = 'source-over'
      const [cr, cg, cb] = FOG_COLOR
      for (const p of stamps) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
        g.addColorStop(0, `rgba(${cr},${cg},${cb},1)`)
        g.addColorStop(0.45, `rgba(${cr},${cg},${cb},1)`)
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  // Semi-reveal: carve a ragged shred pattern, feathered to the brush circle.
  // The pattern is anchored to image space (same pixels every time), so repeated
  // passes reinforce the same tears rather than creeping toward a clean reveal.
  // The shred tile is built from the stroke's seed, so all clients tear identically.
  private applySemi(stroke: FogStroke) {
    const ctx = this.ctx!
    const r = stroke.radius
    const tile = this.getShred(stroke.seed)

    // stroke bounding box, clamped to the canvas
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const p of stroke.points) {
      if (p.x - r < minX) minX = p.x - r
      if (p.y - r < minY) minY = p.y - r
      if (p.x + r > maxX) maxX = p.x + r
      if (p.y + r > maxY) maxY = p.y + r
    }
    const ox = Math.max(0, Math.floor(minX))
    const oy = Math.max(0, Math.floor(minY))
    const ex = Math.min(this.w, Math.ceil(maxX))
    const ey = Math.min(this.h, Math.ceil(maxY))
    const bw = ex - ox
    const bh = ey - oy
    if (bw <= 0 || bh <= 0) return

    this.scratch.width = bw
    this.scratch.height = bh
    const s = this.scratch.getContext('2d')!

    // 1) brush coverage mask: feathered stamps in white, in scratch-local coords
    s.globalCompositeOperation = 'source-over'
    for (const p of stampCenters(stroke.points, r, 0.85)) {
      const cx = p.x - ox
      const cy = p.y - oy
      const g = s.createRadialGradient(cx, cy, 0, cx, cy, r)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.6, 'rgba(255,255,255,1)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      s.fillStyle = g
      s.beginPath()
      s.arc(cx, cy, r, 0, Math.PI * 2)
      s.fill()
    }

    // 2) intersect the mask with the shred pattern, anchored to image space
    s.globalCompositeOperation = 'destination-in'
    const pat = s.createPattern(tile, 'repeat')!
    const phaseX = ((ox % SHRED_TILE) + SHRED_TILE) % SHRED_TILE
    const phaseY = ((oy % SHRED_TILE) + SHRED_TILE) % SHRED_TILE
    s.save()
    s.translate(-phaseX, -phaseY)
    s.fillStyle = pat
    s.fillRect(0, 0, bw + SHRED_TILE, bh + SHRED_TILE)
    s.restore()
    s.globalCompositeOperation = 'source-over'

    // 3) carve the torn coverage out of the fog (slightly < 1 leaves a faint film)
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.globalAlpha = 0.9
    ctx.drawImage(this.scratch, ox, oy)
    ctx.globalAlpha = 1
    ctx.restore()
  }

  private getShred(seed: number): HTMLCanvasElement {
    const cached = this.shredCache.get(seed)
    if (cached) return cached
    const rng = mulberry32(seed)
    const tile = document.createElement('canvas')
    tile.width = SHRED_TILE
    tile.height = SHRED_TILE
    const c = tile.getContext('2d')!
    c.lineCap = 'round'
    const baseAngle = -0.35 // overall lean of the tears
    for (let i = 0; i < 22; i++) {
      const x = rng() * SHRED_TILE
      const y = rng() * SHRED_TILE
      const ang = baseAngle + (rng() - 0.5) * 0.5
      const len = 24 + rng() * 60
      const thick = 3 + rng() * 6
      const exx = x + Math.cos(ang) * len
      const eyy = y + Math.sin(ang) * len
      const mkx = (x + exx) / 2 + (rng() - 0.5) * 8
      const mky = (y + eyy) / 2 + (rng() - 0.5) * 8
      // wrap into the 8 neighbours so the tile repeats seamlessly
      for (let oxx = -1; oxx <= 1; oxx++) {
        for (let oyy = -1; oyy <= 1; oyy++) {
          const dx = oxx * SHRED_TILE
          const dy = oyy * SHRED_TILE
          const g = c.createLinearGradient(x + dx, y + dy, exx + dx, eyy + dy)
          g.addColorStop(0, 'rgba(0,0,0,0)')
          g.addColorStop(0.25, 'rgba(0,0,0,1)')
          g.addColorStop(0.75, 'rgba(0,0,0,1)')
          g.addColorStop(1, 'rgba(0,0,0,0)')
          c.strokeStyle = g
          c.lineWidth = thick
          c.beginPath()
          c.moveTo(x + dx, y + dy)
          c.quadraticCurveTo(mkx + dx, mky + dy, exx + dx, eyy + dy)
          c.stroke()
        }
      }
    }
    this.shredCache.set(seed, tile)
    return tile
  }
}
