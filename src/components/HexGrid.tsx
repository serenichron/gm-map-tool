import { useEffect, useRef } from 'react'

const rot = (x: number, y: number, a: number) => ({
  x: x * Math.cos(a) - y * Math.sin(a),
  y: x * Math.sin(a) + y * Math.cos(a),
})

/** Draw a pointy-top hexagon grid, rotated by `angleDeg`, as one stroked path. */
function drawHexGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  r: number,
  color: string,
  color2: string,
  lineWidth: number,
  angleDeg: number,
  opacity: number,
) {
  ctx.clearRect(0, 0, w, h)
  if (r < 6 || opacity <= 0) return
  const a = (angleDeg * Math.PI) / 180
  const colW = Math.sqrt(3) * r
  const rowH = 1.5 * r

  ctx.save()
  ctx.globalAlpha = Math.min(1, opacity)
  ctx.rotate(a)
  // the region of (rotated) lattice space that maps onto the canvas
  const corners = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ].map(([x, y]) => rot(x, y, -a))
  const minX = Math.min(...corners.map((c) => c.x))
  const maxX = Math.max(...corners.map((c) => c.x))
  const minY = Math.min(...corners.map((c) => c.y))
  const maxY = Math.max(...corners.map((c) => c.y))

  // repeating gold→dark→gold sheen across the drawn span
  const grad = ctx.createLinearGradient(minX, minY, maxX, maxY)
  const cycles = Math.max(3, Math.round(Math.hypot(maxX - minX, maxY - minY) / 280))
  for (let i = 0; i <= cycles; i++) {
    grad.addColorStop(i / cycles, color)
    if (i < cycles) grad.addColorStop((i + 0.5) / cycles, color2)
  }
  ctx.strokeStyle = grad
  ctx.lineWidth = lineWidth

  const rowStart = Math.floor(minY / rowH) - 1
  const rowEnd = Math.ceil(maxY / rowH) + 1
  const colStart = Math.floor(minX / colW) - 1
  const colEnd = Math.ceil(maxX / colW) + 1

  ctx.beginPath()
  for (let row = rowStart; row <= rowEnd; row++) {
    const cy = row * rowH
    const xoff = ((row % 2) + 2) % 2 ? colW / 2 : 0
    for (let col = colStart; col <= colEnd; col++) {
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
  ctx.restore()
}

/**
 * A hex-tile overlay in image space. Lives inside the stage so it pans/zooms
 * with the map. Redraws only when its inputs change.
 */
export function HexGrid({
  width,
  height,
  size,
  angle = 0,
  opacity = 1,
  color = 'rgba(232,183,94,0.45)', // gold
  color2 = 'rgba(153,112,51,0.45)', // dark gold (closer to the gold)
  lineWidth = 2,
}: {
  width: number
  height: number
  size: number
  angle?: number
  opacity?: number
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
    if (ctx) drawHexGrid(ctx, width, height, size, color, color2, lineWidth, angle, opacity)
  }, [width, height, size, angle, opacity, color, color2, lineWidth])

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute left-0 top-0"
      style={{ width, height }}
    />
  )
}
