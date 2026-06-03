import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FogController, type FogOp } from '../lib/fog.ts'
import { buildFrost } from '../lib/frost.ts'
import { FogHaze } from '../lib/fogAnim.ts'
import { HexGrid } from './HexGrid.tsx'
import { MapFrame } from './MapFrame.tsx'
import { PinMarker } from './PinMarker.tsx'
import { PinPopover } from './PinPopover.tsx'
import type { GridSettings } from '../lib/types.ts'
import type { PublicPin } from '../lib/transport.ts'
import { computeLabelSides } from '../lib/pins.ts'

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
  onReady,
  gridOpacity,
  baked = false,
}: {
  width: number
  height: number
  mapSrc: string
  fogOps: FogOp[]
  grid: GridSettings | null
  pins: PublicPin[]
  onReady?: () => void
  /** override the grid strength (0–100); undefined = use the GM's setting */
  gridOpacity?: number
  /** the image already has the static veil (frost+shadow) baked in — so only
   *  add the animated haze here, not the client-side frost (which would double
   *  up and fade at the edges) */
  baked?: boolean
}) {
  // 0–100 line strength → absolute alpha. 25 = the default look (0.45 / 0.05).
  const strength = gridOpacity ?? grid?.opacity ?? 25
  const underAlpha = Math.min(1, (strength / 100) * 1.8)
  const overAlpha = (strength / 100) * 0.2
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // true once fog has actually been drawn this session; drives a dust curtain
  // that hides the bare map whenever fog isn't painted (initial load + resume)
  const [painted, setPainted] = useState(false)
  // bumped whenever the fog is (re)drawn, so pin coverage is re-sampled
  const [coverTick, setCoverTick] = useState(0)
  const readyRef = useRef(false)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const bakedRef = useRef(baked)
  bakedRef.current = baked

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
    const img = mapImgRef.current
    if (!img || !W || !H) return

    // only resize when it actually changed — resizing clears the canvas, which
    // would flash on every re-render / live update
    const fitCanvas = (cv: HTMLCanvasElement) => {
      if (cv.width !== W || cv.height !== H) {
        cv.width = W
        cv.height = H
      }
    }

    const off = offscreenFog.current
    fitCanvas(off)
    fogRef.current.attach(off, W, H)
    fogRef.current.setOps(ops)

    const blurR = Math.max(8, Math.round(Math.min(W, H) * 0.012))
    const shift = Math.max(14, Math.round(Math.min(W, H) * 0.022))
    const half = Math.round(shift / 2)

    const cover = coverMask.current
    buildBlurredMask(cover, off, W, H, blurR, -half, -half)

    const depth = depthRef.current
    const frost = frostRef.current
    if (bakedRef.current) {
      // the veil (frost + shadow) is baked into the base image; only the
      // animated haze is layered here, so nothing client-side fades at the edges
      if (depth) {
        fitCanvas(depth)
        depth.getContext('2d')!.clearRect(0, 0, W, H)
      }
      if (frost) {
        fitCanvas(frost)
        frost.getContext('2d')!.clearRect(0, 0, W, H)
      }
    } else {
      if (depth) {
        fitCanvas(depth)
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
      if (frost) {
        fitCanvas(frost)
        buildFrost(frost, cover, img, W, H)
      }
    }

    const anim = fogAnimRef.current
    if (anim) {
      fitCanvas(anim)
      hazeRef.current.configure(anim, cover, W, H)
    }

    setPainted(true)
    setCoverTick((t) => t + 1)
    if (!readyRef.current) {
      readyRef.current = true
      onReadyRef.current?.()
    }
  }, [])

  // (re)load the map image for the frost, then render. Handle already-cached
  // images (onload may not fire for a complete image) — else the fog never draws.
  useEffect(() => {
    const img = new Image()
    let fired = false
    const done = () => {
      if (fired) return // onload and the complete-check must not both render
      fired = true
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

  // redraw on return-to-view (mobile discards canvases while backgrounded).
  // visibilitychange only fires on an actual change (not initial load); pageshow
  // only redraws on a bfcache restore — so initial load isn't double-rendered.
  useEffect(() => {
    // most reliable signal: the haze loop's first painted frame after resuming
    hazeRef.current.onResume = renderFog
    const onVisible = () => {
      // raise the curtain the moment we're hidden, so a wiped canvas on
      // resume is covered until the repaint lands
      if (document.hidden) setPainted(false)
      else renderFog()
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) renderFog()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('focus', renderFog)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('focus', renderFog)
      hazeRef.current.onResume = null
      hazeRef.current.stop()
    }
  }, [renderFog])

  const selectedPin = pins.find((p) => p.id === selectedId) ?? null
  const labelSides = computeLabelSides(pins)

  // which pins sit under opaque fog right now (sampled from the rendered mask),
  // so under-fog pins hide there and over-fog pins show veiled
  const covered = useMemo(() => {
    const off = offscreenFog.current
    const m: Record<string, boolean> = {}
    const ctx = off && off.width ? off.getContext('2d', { willReadFrequently: true }) : null
    for (const p of pins) {
      if (!ctx) {
        m[p.id] = false
        continue
      }
      const px = Math.max(0, Math.min(off!.width - 1, Math.round(p.x)))
      const py = Math.max(0, Math.min(off!.height - 1, Math.round(p.y)))
      try {
        m[p.id] = ctx.getImageData(px, py, 1, 1).data[3] > 140
      } catch {
        m[p.id] = false
      }
    }
    return m
    // coverTick changes each time the fog is redrawn → re-sample
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, coverTick])

  // a quick tap-and-release outside the open popover (and not on a pin) closes
  // it — but a press that drags (panning) or is held (tap-and-hold) leaves it open
  useEffect(() => {
    if (!selectedId) return
    let start: { x: number; y: number; t: number; outside: boolean } | null = null
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      const outside = !(t?.closest('[data-popover]') || t?.closest('[data-pin]'))
      start = { x: e.clientX, y: e.clientY, t: e.timeStamp, outside }
    }
    const onUp = (e: PointerEvent) => {
      if (
        start?.outside &&
        Math.hypot(e.clientX - start.x, e.clientY - start.y) <= 4 &&
        e.timeStamp - start.t <= 400
      ) {
        setSelectedId(null)
      }
      start = null
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerup', onUp)
    }
  }, [selectedId])

  return (
    <>
      {/* grid on the ground, under everything fog-related */}
      {grid?.enabled && (
        <HexGrid width={width} height={height} size={grid.size} angle={grid.angle ?? 0} opacity={underAlpha} />
      )}
      <canvas ref={depthRef} className="pointer-events-none absolute left-0 top-0" style={{ width, height }} />
      <canvas ref={frostRef} className="pointer-events-none absolute left-0 top-0" style={{ width, height }} />
      <canvas ref={fogAnimRef} className="pointer-events-none absolute left-0 top-0" style={{ width, height }} />
      {/* faint pass over the fog: hex structure shows through without revealing terrain */}
      {grid?.enabled && (
        <HexGrid
          width={width}
          height={height}
          size={grid.size}
          angle={grid.angle ?? 0}
          opacity={overAlpha}
        />
      )}
      {/* dust curtain: hides the bare map whenever fog isn't painted (initial
          load, and the instant after returning from the background). Fades out
          as soon as fog draws, so it's invisible in normal use. */}
      <div
        className="pointer-events-none absolute left-0 top-0 transition-opacity duration-300"
        style={{ width, height, background: '#16110b', opacity: painted ? 0 : 1 }}
      />
      <div className="pointer-events-none absolute left-0 top-0" style={{ width, height }}>
        {pins.map((p) => {
          const cov = covered[p.id]
          // under-fog pins (the default) only show where the fog is cleared
          if (!p.aboveFog && cov) return null
          // over-fog pins look veiled while they're over fogged ground
          const veiled = !!p.aboveFog && cov
          const showLabel = veiled ? !!p.labelAboveFog : true
          return (
            <PinMarker
              key={p.id}
              pin={{ ...p, gmNote: '' }}
              interactive={false}
              labelSide={labelSides[p.id]}
              veiled={veiled}
              showLabel={showLabel}
              screenToImage={() => ({ x: 0, y: 0 })}
              onMove={() => {}}
              onOpen={setSelectedId}
            />
          )
        })}
        {selectedPin && <PinPopover pin={selectedPin} onClose={() => setSelectedId(null)} />}
      </div>
      <MapFrame width={width} height={height} />
    </>
  )
}
