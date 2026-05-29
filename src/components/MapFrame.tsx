import { useEffect, useRef } from 'react'

/** A worn golden frame around the map edges. Drawn at a capped resolution and
 *  stretched to the map, so it stays light on memory while scaling with zoom. */
function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h)
  const T = Math.max(6, Math.round(Math.min(w, h) * 0.012)) // frame thickness

  // metallic gold sheen, repeating a couple of times around the frame
  const grad = ctx.createLinearGradient(0, 0, w, h)
  const cycles = 2
  for (let i = 0; i <= cycles; i++) {
    grad.addColorStop(i / cycles, '#f0d28a')
    if (i < cycles) grad.addColorStop((i + 0.5) / cycles, '#6e4a1c')
  }

  // the band: fill the whole rect, cut out the opening
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.clearRect(T, T, w - 2 * T, h - 2 * T)

  // dark grooves on the outer edge and the opening, for depth
  ctx.lineWidth = Math.max(1.5, T * 0.08)
  ctx.strokeStyle = 'rgba(18,11,6,0.7)'
  const o = ctx.lineWidth / 2
  ctx.strokeRect(o, o, w - 2 * o, h - 2 * o)
  ctx.strokeRect(T, T, w - 2 * T, h - 2 * T)

  // bright bevel lines
  ctx.lineWidth = Math.max(1, T * 0.05)
  ctx.strokeStyle = 'rgba(247,226,165,0.75)'
  ctx.strokeRect(T * 0.3, T * 0.3, w - T * 0.6, h - T * 0.6)
  ctx.strokeStyle = 'rgba(247,226,165,0.45)'
  ctx.strokeRect(T * 0.7, T * 0.7, w - T * 1.4, h - T * 1.4)

  // crystal accents on the four corners
  const cs = T * 1.05
  for (const [cx, cy] of [
    [T, T],
    [w - T, T],
    [T, h - T],
    [w - T, h - T],
  ] as [number, number][]) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = grad
    ctx.fillRect(-cs / 2, -cs / 2, cs, cs)
    ctx.lineWidth = Math.max(1, T * 0.06)
    ctx.strokeStyle = 'rgba(18,11,6,0.75)'
    ctx.strokeRect(-cs / 2, -cs / 2, cs, cs)
    ctx.restore()
  }
}

export function MapFrame({ width, height }: { width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    // cap the backing resolution (decorative); stretch uniformly to the map
    const k = Math.min(1, 1200 / Math.max(width, height))
    const cw = Math.max(1, Math.round(width * k))
    const ch = Math.max(1, Math.round(height * k))
    c.width = cw
    c.height = ch
    const ctx = c.getContext('2d')
    if (ctx) drawFrame(ctx, cw, ch)
  }, [width, height])

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute left-0 top-0"
      style={{ width, height }}
    />
  )
}
