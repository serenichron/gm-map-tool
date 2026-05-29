import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell.tsx'
import { Viewport } from '../components/Viewport.tsx'
import { PinMarker } from '../components/PinMarker.tsx'
import { PinPopover } from '../components/PinPopover.tsx'
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

const tbtn =
  'inline-flex items-center justify-center rounded-[9px] border border-line bg-panel-2 px-3 py-2 font-ui text-[13px] font-medium text-bone transition hover:border-[#6a5232] hover:bg-[#352818]'

type Pub = { version: number; width: number; height: number; src: string; fogOps: Snapshot['fogOps'] }

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
  const [zoom, setZoom] = useState(1)

  const fogRef = useRef<FogController>(null as unknown as FogController)
  if (!fogRef.current) fogRef.current = new FogController()
  const offscreenFog = useRef<HTMLCanvasElement>(null as unknown as HTMLCanvasElement)
  if (!offscreenFog.current) offscreenFog.current = document.createElement('canvas')
  // a blurred copy of the fog mask — softens the fog→clear edges for both layers
  const softMask = useRef<HTMLCanvasElement>(null as unknown as HTMLCanvasElement)
  if (!softMask.current) softMask.current = document.createElement('canvas')

  const depthCanvasRef = useRef<HTMLCanvasElement>(null)
  const frostCanvasRef = useRef<HTMLCanvasElement>(null)
  const fogAnimRef = useRef<HTMLCanvasElement>(null)
  const hazeRef = useRef<FogHaze>(null as unknown as FogHaze)
  if (!hazeRef.current) hazeRef.current = new FogHaze()
  const mapImgRef = useRef<HTMLImageElement | null>(null)
  const lastVersion = useRef(0)
  const lastBlobUrl = useRef<string | null>(null)
  const didFit = useRef(false)

  const { viewportRef, stageRef, fit, zoomBy, screenToImage } = useViewport(
    pub?.width ?? 0,
    pub?.height ?? 0,
    { onScaleChange: setZoom },
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
        setPub({ version: s.version, width: s.width, height: s.height, src: s.imageUrl, fogOps: s.fogOps })
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

  // render fog -> frost whenever a new published state arrives
  useLayoutEffect(() => {
    if (!pub) return
    const frost = frostCanvasRef.current
    const img = mapImgRef.current
    if (!frost || !img) return
    const off = offscreenFog.current
    off.width = pub.width
    off.height = pub.height
    fogRef.current.attach(off, pub.width, pub.height)
    fogRef.current.setOps(pub.fogOps)

    const W = pub.width
    const H = pub.height
    const blurR = Math.max(8, Math.round(Math.min(W, H) * 0.012))

    // soft mask: blur the fog so cleared edges diffuse. Draw it overflowing the
    // canvas by the blur radius so the *outer* map border stays solid (otherwise
    // the blur samples past the edge and fades the whole margin).
    const soft = softMask.current
    soft.width = W
    soft.height = H
    const sc = soft.getContext('2d')!
    sc.clearRect(0, 0, W, H)
    sc.filter = `blur(${blurR}px)`
    sc.drawImage(off, -blurR, -blurR, W + 2 * blurR, H + 2 * blurR)
    sc.filter = 'none'

    // depth: a soft DIRECTIONAL shadow cast onto the revealed ground along the
    // fog edge — as if the fog bank stands above the ground and is lit from the
    // upper-left, so it drops a shadow down-right into the cleared gap.
    const depth = depthCanvasRef.current
    if (depth) {
      depth.width = W
      depth.height = H
      const dc = depth.getContext('2d')!
      const reach = Math.max(14, Math.round(Math.min(W, H) * 0.03))
      const off2 = reach * 0.7 // shadow offset → directional cast
      dc.clearRect(0, 0, W, H)
      dc.filter = `blur(${reach}px)`
      dc.drawImage(off, off2, off2, W, H) // blurred fog, pushed down-right
      dc.filter = 'none'
      dc.globalCompositeOperation = 'destination-out'
      dc.drawImage(off, 0, 0, W, H) // remove the actual fog area → shadow lands on cleared ground
      dc.globalCompositeOperation = 'source-in'
      dc.fillStyle = 'rgba(6,4,2,0.6)' // warm near-black shadow
      dc.fillRect(0, 0, W, H)
      dc.globalCompositeOperation = 'source-over'
    }

    frost.width = W
    frost.height = H
    buildFrost(frost, soft, img, W, H)
    // start/refresh the drifting fog haze, masked to the same soft fog
    const anim = fogAnimRef.current
    if (anim) {
      anim.width = pub.width
      anim.height = pub.height
      hazeRef.current.configure(anim, soft, pub.width, pub.height)
    }
    if (!didFit.current) {
      didFit.current = true
      fit()
    }
  }, [pub, fit])

  // stop the animation loop on unmount
  useEffect(() => () => hazeRef.current.stop(), [])

  const selectedPin = pins.find((p) => p.id === selectedId) ?? null

  const toolbar = (
    <div className="flex flex-1 items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-ui text-[10px] uppercase tracking-[0.16em] ${
          connected ? 'border-teal-dim bg-teal/10 text-teal' : 'border-line text-bone-dim'
        }`}
        title={connected ? 'Connected' : 'Connecting…'}
      >
        ● {connected ? 'live' : '…'}
      </span>
      <div className="flex-1" />
      {pub && (
        <div className="flex items-center gap-1.5">
          <button className={tbtn} onClick={() => zoomBy(1 / 1.2)} title="Zoom out">
            −
          </button>
          <span className="min-w-[42px] text-center font-ui text-[11px] text-bone-dim">
            {Math.round(zoom * 100)}%
          </span>
          <button className={tbtn} onClick={() => zoomBy(1.2)} title="Zoom in">
            +
          </button>
          <button className={tbtn} onClick={() => fit()} title="Fit map to screen">
            Fit
          </button>
        </div>
      )}
    </div>
  )

  return (
    <AppShell role="player" toolbar={toolbar}>
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
