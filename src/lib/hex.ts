/**
 * Pointy-top hex grid geometry, with an optional orientation angle (degrees).
 * The whole lattice rotates about the origin by `angle`, so clicks, clears and
 * the drawn grid all stay aligned. Hexagons have 60° symmetry, so 0–60 covers
 * every distinct orientation (0 = corner up/down, 30 = flat top).
 *
 * Spacing: column = √3·size, row = 1.5·size, odd rows shifted by half.
 */

export type HexCell = { col: number; row: number }

function rot(x: number, y: number, a: number): { x: number; y: number } {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: x * c - y * s, y: x * s + y * c }
}

function localCenter(col: number, row: number, size: number): { x: number; y: number } {
  const colW = Math.sqrt(3) * size
  const rowH = 1.5 * size
  const xoff = ((row % 2) + 2) % 2 ? colW / 2 : 0
  return { x: col * colW + xoff, y: row * rowH }
}

export function hexCenter(col: number, row: number, size: number, angle = 0): { x: number; y: number } {
  const lc = localCenter(col, row, size)
  return angle ? rot(lc.x, lc.y, (angle * Math.PI) / 180) : lc
}

export function hexVertices(cx: number, cy: number, size: number, angle = 0): { x: number; y: number }[] {
  const a = (angle * Math.PI) / 180
  const v: { x: number; y: number }[] = []
  for (let k = 0; k < 6; k++) {
    const ang = (Math.PI / 180) * (60 * k - 90) + a
    v.push({ x: cx + size * Math.cos(ang), y: cy + size * Math.sin(ang) })
  }
  return v
}

/** Which hex contains a point (nearest centre in the un-rotated lattice). */
export function pixelToHex(px: number, py: number, size: number, angle = 0): HexCell {
  const a = (angle * Math.PI) / 180
  const p = angle ? rot(px, py, -a) : { x: px, y: py } // into local (un-rotated) space
  const colW = Math.sqrt(3) * size
  const rowH = 1.5 * size
  const r0 = Math.round(p.y / rowH)
  let best: HexCell = { col: 0, row: 0 }
  let bestD = Infinity
  for (let row = r0 - 1; row <= r0 + 1; row++) {
    const xoff = ((row % 2) + 2) % 2 ? colW / 2 : 0
    const c0 = Math.round((p.x - xoff) / colW)
    for (let col = c0 - 1; col <= c0 + 1; col++) {
      const cx = col * colW + xoff
      const cy = row * rowH
      const d = (p.x - cx) ** 2 + (p.y - cy) ** 2
      if (d < bestD) {
        bestD = d
        best = { col, row }
      }
    }
  }
  return best
}
