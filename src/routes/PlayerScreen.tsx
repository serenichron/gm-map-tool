import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell.tsx'
import { Viewport } from '../components/Viewport.tsx'
import { PinMarker } from '../components/PinMarker.tsx'
import { PinPopover } from '../components/PinPopover.tsx'
import { HexGrid } from '../components/HexGrid.tsx'
import { MapFrame } from '../components/MapFrame.tsx'
import { useViewport } from '../hooks/useViewport.ts'
import { FogController } from '../lib/fog.ts'
import { buildFrost } from '../lib/frost.ts'
import { FogHaze } from '../lib/fogAnim.ts'
import {
  createLocalBackend,
  createSupabaseBackend,
  type Backend,
  type PublicPin,
  type Snapshot,
} from '../lib/transport.ts'
import { hasSupabase } from '../lib/supabase.ts'
import { ensureSession } from '../lib/session.ts'
import { getRoomByCode } from '../lib/rooms.ts'
import { addRecentRoom } from '../lib/recent.ts'
import { Icon } from '../components/icons.tsx'

/**
 * Build a blurred copy of the fog mask, translated by (dx,dy) WITHOUT scaling
 * (so the offset is uniform). The fog's edges are stretched outward (clamped) to
 * fill the margin the shift/blur would otherwise leave, keeping the map border
 * covered.
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
  const e = blurR + Math.max(Math.abs(dx), Math.abs(dy)) + 4 // clamp reach
  c.drawImage(off, dx, dy, W, H) // fog, translated, natural scale
  // stretch the four edges outward so borders/margins stay covered
  c.drawImage(off, 0, 0, 1, H, dx - e, dy - e, e, H + 2 * e) // left
  c.drawImage(off, W - 1, 0, 1, H, dx + W, dy - e, e, H + 2 * e) // right
  c.drawImage(off, 0, 0, W, 1, dx - e, dy - e, W + 2 * e, e) // top
  c.drawImage(off, 0, H - 1, W, 1, dx - e, dy + H, W + 2 * e, e) // bottom
  c.filter = 'none'
}

type Pub = {
  version: number
  width: number
  height: number
  src: string
  fogOps: Snapshot['fogOps']
  grid: Snapshot['grid']
}

/**
 * Player view. Read-only. Joins a room by code (or the local backend with none),
 * subscribes to the publish gate, replays the fog ops (so semi-reveal tears land
 * identically), shows the frosted veil over hidden ground, and lets players tap
 * pins for their notes. Reconnect is free: latest snapshot is read on load.
 */
export function PlayerScreen() {
  const [searchParams] = useSearchParams()
  const [pub, setPub] = useState<Pub | null>(null)
  const [pins, setPins] = useState<PublicPin[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fogRef = useRef<FogController>(null as unknown as FogController)
  if (!fogRef.current) {
    fogRef.current = new FogController()
    fogRef.current.hexClearScale = 1.2 // players see the clear bleed a bit past tiles
    fogRef.current.hexClearShiftY = 0.15 // and a touch lower
  }
  const offscreenFog = useRef<HTMLCanvasElement>(null as unknown as HTMLCanvasElement)
  if (!offscreenFog.current) offscreenFog.current = document.createElement('canvas')
  // one blurred fog mask, shifted up-left; frost, haze AND the drop shadow all
  // derive from it so the clearing is coherent (no second, offset hole)
  const coverMask = useRef<HTMLCanvasElement>(null as unknown as HTMLCanvasElement)
  if (!coverMask.current) coverMask.current = document.createElement('canvas')

  const depthCanvasRef = useRef<HTMLCanvasElement>(null)
  const frostCanvasRef = useRef<HTMLCanvasElement>(null)
  const fogAnimRef = useRef<HTMLCanvasElement>(null)
  const hazeRef = useRef<FogHaze>(null as unknown as FogHaze)
  if (!hazeRef.current) hazeRef.current = new FogHaze()
  const mapImgRef = useRef<HTMLImageElement | null>(null)
  const lastVersion = useRef(0)
  const lastBlobUrl = useRef<string | null>(null)
  const didFit = useRef(false)
  const pubRef = useRef<Pub | null>(null)

  const { viewportRef, stageRef, fit, screenToImage } = useViewport(
    pub?.width ?? 0,
    pub?.height ?? 0,
  )

  useEffect(() => {
    let alive = true
    let unsub = () => {}

    const apply = (s: Snapshot) => {
      if (!alive || s.version <= lastVersion.current) return
      lastVersion.current = s.version
      const img = new Image()
      img.onload = () => {
        if (!alive) return
        if (lastBlobUrl.current) URL.revokeObjectURL(lastBlobUrl.current)
        lastBlobUrl.current = s.imageUrl.startsWith('blob:') ? s.imageUrl : null
        mapImgRef.current = img
        setPins(s.pins)
        setPub({
          version: s.version,
          width: s.width,
          height: s.height,
          src: s.imageUrl,
          fogOps: s.fogOps,
          grid: s.grid,
        })
      }
      img.onerror = () => setError('Could not load the map image.')
      img.src = s.imageUrl
    }

    ;(async () => {
      let backend: Backend
      const code = searchParams.get('c')
      if (hasSupabase && code) {
        await ensureSession()
        const room = await getRoomByCode(code)
        if (!alive) return
        if (!room) {
          setError('No room with that code.')
          return
        }
        addRecentRoom({ code: room.join_code, name: room.name })
        backend = createSupabaseBackend(room.id)
      } else {
        backend = createLocalBackend()
      }
      unsub = backend.subscribe(apply)
      const latest = await backend.requestLatest()
      if (!alive) return
      setConnected(true)
      if (latest) apply(latest)
    })()

    return () => {
      alive = false
      unsub()
      if (lastBlobUrl.current) URL.revokeObjectURL(lastBlobUrl.current)
    }
  }, [searchParams])

  // Draw all the fog layers from the current published state. Reads refs only,
  // so it can be called from the render effect AND whenever the page becomes
  // visible again — mobile browsers discard canvas contents while backgrounded,
  // which would otherwise leave the bare map showing on resume.
  const renderFog = useCallback(() => {
    const p = pubRef.current
    const frost = frostCanvasRef.current
    const img = mapImgRef.current
    if (!p || !frost || !img) return

    const W = p.width
    const H = p.height
    const off = offscreenFog.current
    off.width = W
    off.height = H
    fogRef.current.attach(off, W, H)
    fogRef.current.setOps(p.fogOps)

    const blurR = Math.max(8, Math.round(Math.min(W, H) * 0.012))
    const shift = Math.max(14, Math.round(Math.min(W, H) * 0.022)) // shadow offset
    const half = Math.round(shift / 2) // up-left shift so the bright clear re-centres

    // one fog mask, shifted up-left. Everything below derives from it.
    const cover = coverMask.current
    buildBlurredMask(cover, off, W, H, blurR, -half, -half)

    // depth: drop shadow of the same (shifted) fog, pushed down-right.
    const depth = depthCanvasRef.current
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

  // (re)draw when a new published state arrives
  useLayoutEffect(() => {
    pubRef.current = pub
    if (!pub) return
    renderFog()
    if (!didFit.current) {
      didFit.current = true
      fit()
    }
  }, [pub, renderFog, fit])

  // redraw fog when the page returns to view, and stop the haze on unmount
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

  const iconBtn =
    'inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-line bg-panel-2 text-bone transition hover:border-[#6a5232] hover:bg-[#352818]'

  const topRight = (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 font-ui text-[10px] uppercase tracking-[0.16em] ${
          connected ? 'text-teal' : 'text-bone-dim'
        }`}
        title={connected ? 'Connected to the GM — receiving updates live' : 'Connecting…'}
      >
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-teal' : 'bg-bone-dim'}`} />
        {connected ? 'Live' : '…'}
      </span>
      {pub && (
        <button className={iconBtn} onClick={() => fit()} title="Fit map to screen">
          <Icon name="fit" />
        </button>
      )}
    </div>
  )

  return (
    <AppShell role="player" topRight={topRight}>
      <div className="relative flex flex-1 bg-[radial-gradient(130%_100%_at_50%_30%,#241a11_0%,#140e08_70%,#0a0704_100%)]">
        {pub ? (
          <Viewport
            viewportRef={viewportRef}
            stageRef={stageRef}
            src={pub.src}
            width={pub.width}
            height={pub.height}
            cursorClass="cursor-grab"
          >
            {/* grid sits on the ground beneath everything fog-related, so the fog
                covers it where present and it stays crisp where cleared */}
            {pub.grid?.enabled && (
              <HexGrid width={pub.width} height={pub.height} size={pub.grid.size} />
            )}
            <canvas
              ref={depthCanvasRef}
              className="pointer-events-none absolute left-0 top-0"
              style={{ width: pub.width, height: pub.height }}
            />
            <canvas
              ref={frostCanvasRef}
              width={pub.width}
              height={pub.height}
              className="pointer-events-none absolute left-0 top-0"
              style={{ width: pub.width, height: pub.height }}
            />
            <canvas
              ref={fogAnimRef}
              className="pointer-events-none absolute left-0 top-0"
              style={{ width: pub.width, height: pub.height }}
            />
            {/* faint second pass OVER the fog: shows the hex structure through the
                fog (just thin lines) without revealing the terrain behind it */}
            {pub.grid?.enabled && (
              <HexGrid
                width={pub.width}
                height={pub.height}
                size={pub.grid.size}
                color="rgba(232,183,94,0.05)"
                color2="rgba(153,112,51,0.05)"
              />
            )}
            <div className="pointer-events-none absolute left-0 top-0" style={{ width: pub.width, height: pub.height }}>
              {pins.map((p) => (
                <PinMarker
                  key={p.id}
                  pin={{ ...p, gmNote: '' }}
                  interactive={false}
                  screenToImage={screenToImage}
                  onMove={() => {}}
                  onOpen={setSelectedId}
                />
              ))}
            </div>
            <MapFrame width={pub.width} height={pub.height} />
          </Viewport>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3.5 text-center">
            {error ? (
              <>
                <h3 className="font-display text-[22px] font-semibold text-bone">{error}</h3>
                <p className="font-ui text-[14px] text-bone-dim">Check the code with your GM.</p>
              </>
            ) : (
              <>
                <div className="h-16 w-16 animate-spin rounded-full border-[3px] border-[#3a2c1c] border-t-ochre [animation-duration:1.4s]" />
                <h3 className="font-display text-[22px] font-semibold text-bone">The dust has not cleared</h3>
                <p className="font-ui text-[14px] tracking-[0.04em] text-bone-dim">
                  Waiting for the GM to reveal the map…
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {selectedPin && <PinPopover pin={selectedPin} onClose={() => setSelectedId(null)} />}
    </AppShell>
  )
}
