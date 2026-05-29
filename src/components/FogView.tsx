import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FogController, type FogOp } from '../lib/fog.ts'
import { buildFrost } from '../lib/frost.ts'
import { FogHaze } from '../lib/fogAnim.ts'
import { HexGrid } from './HexGrid.tsx'
import { MapFrame } from './MapFrame.tsx'
import { PinMarker } from './PinMarker.tsx'
import { PinPopover } from './PinPopover.tsx'
import type { GridSettings } from '../lib/types.ts'
import type { PublicPin } from '../lib/transport.ts'

/**
 * Build a blurred copy of the fog mask, translated by (dx,dy) WITHOUT scaling
 * (uniform offset). Edges are stretched outward (clamped) so the map border
 * stays covered.
 */
function buildBlurredMask(
  dest: HTMLCanvasElement,
  off: HTMLCanvasElement,
  W: number,
  H: number,
  blurR: number,
  dx: number,
  dy: number,
) {
  dest.width = W
  dest.height = H
  const c = dest.getContext('2d')!
  c.clearRect(0, 0, W, H)
  c.filter = `blur(${blurR}px)`
  const e = blurR + Math.max(Math.abs(dx), Math.abs(dy)) + 4
  c.drawImage(off, dx, dy, W, H)
  c.drawImage(off, 0, 0, 1, H, dx - e, dy - e, e, H + 2 * e)
  c.drawImage(off, W - 1, 0, 1, H, dx + W, dy - e, e, H + 2 * e)
  c.drawImage(off, 0, 0, W, 1, dx - e, dy - e, W + 2 * e, e)
  c.drawImage(off, 0, H - 1, W, 1, dx - e, dy + H, W + 2 * e, e)
  c.filter = 'none'
}

/**
 * Renders the fog exactly as players see it — frosted ground hint, drifting
 * cloud haze, drop shadow, hex grid (two passes) and the framed pins — for a
 * given fog op list and map image. Used by the player view and by the GM's
 * "preview as player" mode. Place inside a Viewport's stage (image-space).
 */
export function FogView({
  width,
  height,
  mapSrc,
  fogOps,
  grid,
  pins,
}: {
  width: number
  height: number
  mapSrc: string
  fogOps: FogOp[]
  grid: GridSettings | null
  pins: PublicPin[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fogRef = useRef<FogController>(null as unknown as FogController)
  if (!fogRef.current) {
    fogRef.current = new FogController()
    fogRef.current.hexClearScale = 1.2 // players see the clear bleed a bit past tiles
    fogRef.current.hexClearShiftY = 0.15 // and a touch lower
  }
  const offscreenFog = useRef<HTMLCanvasElement>(null as unknown as HTMLCanvasElement)
  if (!offscreenFog.current) offscreenFog.current = document.createElement('canvas')
  const coverMask = useRef<HTMLCanvasElement>(null as unknown as HTMLCanvasElement)
  if (!coverMask.current) coverMask.current = document.createElement('canvas')

  const depthRef = useRef<HTMLCanvasElement>(null)
  const frostRef = useRef<HTMLCanvasElement>(null)
  const fogAnimRef = useRef<HTMLCanvasElement>(null)
  const hazeRef = useRef<FogHaze>(null as unknown as FogHaze)
  if (!hazeRef.current) hazeRef.current = new FogHaze()
  const mapImgRef = useRef<HTMLImageElement | null>(null)
  const stateRef = useRef({ width, height, fogOps, grid })
  stateRef.current = { width, height, fogOps, grid }

  const renderFog = useCallback(() => {
    const { width: W, height: H, fogOps: ops } = stateRef.current
    const frost = frostRef.current
    const img = mapImgRef.current
    if (!frost || !img || !W || !H) return

    const off = offscreenFog.current
    off.width = W
    off.height = H
    fogRef.current.attach(off, W, H)
    fogRef.current.setOps(ops)

    const blurR = Math.max(8, Math.round(Math.min(W, H) * 0.012))
    const shift = Math.max(14, Math.round(Math.min(W, H) * 0.022))
    const half = Math.round(shift / 2)

    const cover = coverMask.current
    buildBlurredMask(cover, off, W, H, blurR, -half, -half)

    const depth = depthRef.current
    if (depth) {
      depth.width = W
      depth.height = H
      const dc = depth.getContext('2d')!
      dc.clearRect(0, 0, W, H)
      dc.filter = `blur(${Math.round(shift * 0.45)}px)`
      dc.drawImage(cover, shift, shift, W, H)
      dc.filter = 'none'
      dc.globalCompositeOperation = 'source-in'
      dc.fillStyle = 'rgba(6,4,2,0.72)'
      dc.fillRect(0, 0, W, H)
      dc.globalCompositeOperation = 'source-over'
    }

    frost.width = W
    frost.height = H
    buildFrost(frost, cover, img, W, H)

    const anim = fogAnimRef.current
    if (anim) {
      anim.width = W
      anim.height = H
      hazeRef.current.configure(anim, cover, W, H)
    }
  }, [])

  // (re)load the map image for the frost, then render. Handle already-cached
  // images (onload may not fire for a complete image) — else the fog never draws.
  useEffect(() => {
    const img = new Image()
    const done = () => {
      mapImgRef.current = img
      renderFog()
    }
    img.onload = done
    img.src = mapSrc
    if (img.complete && img.naturalWidth > 0) done()
  }, [mapSrc, renderFog])

  // redraw when inputs change
  useLayoutEffect(() => {
    renderFog()
  }, [width, height, fogOps, grid, renderFog])

  // redraw on return-to-view (mobile discards canvases while backgrounded)
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) renderFog()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onVisible)
      window.removeEventListener('focus', onVisible)
      hazeRef.current.stop()
    }
  }, [renderFog])

  const selectedPin = pins.find((p) => p.id === selectedId) ?? null

  return (
    <>
      {/* grid on the ground, under everything fog-related */}
      {grid?.enabled && <HexGrid width={width} height={height} size={grid.size} />}
      <canvas ref={depthRef} className="pointer-events-none absolute left-0 top-0" style={{ width, height }} />
      <canvas ref={frostRef} className="pointer-events-none absolute left-0 top-0" style={{ width, height }} />
      <canvas ref={fogAnimRef} className="pointer-events-none absolute left-0 top-0" style={{ width, height }} />
      {/* faint pass over the fog: hex structure shows through without revealing terrain */}
      {grid?.enabled && (
        <HexGrid
          width={width}
          height={height}
          size={grid.size}
          color="rgba(232,183,94,0.05)"
          color2="rgba(153,112,51,0.05)"
        />
      )}
      <div className="pointer-events-none absolute left-0 top-0" style={{ width, height }}>
        {pins.map((p) => (
          <PinMarker
            key={p.id}
            pin={{ ...p, gmNote: '' }}
            interactive={false}
            screenToImage={() => ({ x: 0, y: 0 })}
            onMove={() => {}}
            onOpen={setSelectedId}
          />
        ))}
      </div>
      <MapFrame width={width} height={height} />
      {selectedPin && <PinPopover pin={selectedPin} onClose={() => setSelectedId(null)} />}
    </>
  )
}
