import { useEffect, useRef } from 'react'

/** Draw a pointy-top hexagon grid as a single stroked path (cheap). */
function drawHexGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  r: number,
  color: string,
  lineWidth: number,
  alpha: number,
) {
  ctx.clearRect(0, 0, w, h)
  if (r < 6) return
  const colW = Math.sqrt(3) * r // horizontal centre spacing
  const rowH = 1.5 * r // vertical centre spacing
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.globalAlpha = alpha
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
  color = '#e0a94b',
  alpha = 0.5,
  lineWidth = 2,
}: {
  width: number
  height: number
  size: number
  color?: string
  alpha?: number
  lineWidth?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.width = width
    c.height = height
    const ctx = c.getContext('2d')
    if (ctx) drawHexGrid(ctx, width, height, size, color, lineWidth, alpha)
  }, [width, height, size, color, alpha, lineWidth])

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute left-0 top-0"
      style={{ width, height }}
    />
  )
}
