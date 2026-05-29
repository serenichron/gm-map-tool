import { useEffect, useRef } from 'react'

/** Draw a pointy-top hexagon grid as a single stroked path (cheap). */
function drawHexGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  r: number,
  color: string,
  color2: string,
  lineWidth: number,
) {
  ctx.clearRect(0, 0, w, h)
  if (r < 6) return
  const colW = Math.sqrt(3) * r // horizontal centre spacing
  const rowH = 1.5 * r // vertical centre spacing
  // repeating gold -> dark -> gold sheen across the grid (golden shine). Smaller
  // bands (~repeat every ~280px) so the shimmer recurs across the map. The per-
  // colour alpha (set in the rgba stops) gives the lines their transparency.
  const grad = ctx.createLinearGradient(0, 0, w, h)
  const cycles = Math.max(3, Math.round(Math.hypot(w, h) / 280))
  for (let i = 0; i <= cycles; i++) {
    grad.addColorStop(i / cycles, color)
    if (i < cycles) grad.addColorStop((i + 0.5) / cycles, color2)
  }
  ctx.strokeStyle = grad
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  for (let row = -1; row * rowH < h + rowH; row++) {
    const cy = row * rowH
    const xoff = row % 2 ? colW / 2 : 0
    for (let col = -1; col * colW + xoff < w + colW; col++) {
      const cx = col * colW + xoff
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI / 180) * (60 * k - 90)
        const x = cx + r * Math.cos(ang)
        const y = cy + r * Math.sin(ang)
        if (k === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
    }
  }
  ctx.stroke()
  ctx.globalAlpha = 1
}

/**
 * A hex-tile overlay in image space. Golden lines. Lives inside the stage so it
 * pans/zooms with the map. Redraws only when size/dimensions change.
 */
export function HexGrid({
  width,
  height,
  size,
  color = 'rgba(232,183,94,0.45)', // gold
  color2 = 'rgba(110,74,28,0.28)', // dark
  lineWidth = 2,
}: {
  width: number
  height: number
  size: number
  color?: string
  color2?: string
  lineWidth?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.width = width
    c.height = height
    const ctx = c.getContext('2d')
    if (ctx) drawHexGrid(ctx, width, height, size, color, color2, lineWidth)
  }, [width, height, size, color, color2, lineWidth])

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute left-0 top-0"
      style={{ width, height }}
    />
  )
}
