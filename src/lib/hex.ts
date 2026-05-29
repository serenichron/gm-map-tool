/**
 * Pointy-top hex grid geometry. Must match HexGrid's drawing exactly so a click
 * maps to the hex the player sees:
 *   column spacing = √3·size, row spacing = 1.5·size, odd rows shifted by half.
 */

export type HexCell = { col: number; row: number }

export function hexCenter(col: number, row: number, size: number): { x: number; y: number } {
  const colW = Math.sqrt(3) * size
  const rowH = 1.5 * size
  const xoff = ((row % 2) + 2) % 2 ? colW / 2 : 0
  return { x: col * colW + xoff, y: row * rowH }
}

export function hexVertices(cx: number, cy: number, size: number): { x: number; y: number }[] {
  const v: { x: number; y: number }[] = []
  for (let k = 0; k < 6; k++) {
    const ang = (Math.PI / 180) * (60 * k - 90)
    v.push({ x: cx + size * Math.cos(ang), y: cy + size * Math.sin(ang) })
  }
  return v
}

/**
 * Which hex contains a point. For a regular hex lattice each hexagon is the
 * Voronoi cell of its centre, so the containing hex is simply the nearest
 * centre — found by checking the handful of candidates around the point.
 */
export function pixelToHex(px: number, py: number, size: number): HexCell {
  const colW = Math.sqrt(3) * size
  const rowH = 1.5 * size
  const r0 = Math.round(py / rowH)
  let best: HexCell = { col: 0, row: 0 }
  let bestD = Infinity
  for (let row = r0 - 1; row <= r0 + 1; row++) {
    const xoff = ((row % 2) + 2) % 2 ? colW / 2 : 0
    const c0 = Math.round((px - xoff) / colW)
    for (let col = c0 - 1; col <= c0 + 1; col++) {
      const cx = col * colW + xoff
      const cy = row * rowH
      const d = (px - cx) ** 2 + (py - cy) ** 2
      if (d < bestD) {
        bestD = d
        best = { col, row }
      }
    }
  }
  return best
}
