import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell.tsx'
import { Viewport } from '../components/Viewport.tsx'
import { FogView } from '../components/FogView.tsx'
import { Icon } from '../components/icons.tsx'
import { useViewport } from '../hooks/useViewport.ts'
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

type Pub = {
  version: number
  width: number
  height: number
  src: string
  fogOps: Snapshot['fogOps']
  grid: Snapshot['grid']
}

/**
 * Player view. Read-only. Joins a room by code (or the local backend), subscribes
 * to the publish gate, and renders the published fog via the shared FogView.
 */
export function PlayerScreen() {
  const [searchParams] = useSearchParams()
  const [pub, setPub] = useState<Pub | null>(null)
  const [pins, setPins] = useState<PublicPin[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fogReady, setFogReady] = useState(false)
  // grid display: follow the GM, or the player's own line strength (local)
  const [useGmGrid, setUseGmGrid] = useState(() => localStorage.getItem('player-use-gm-grid') !== '0')
  const [playerGridOpacity, setPlayerGridOpacity] = useState(() => {
    const v = Number(localStorage.getItem('player-grid-opacity'))
    return Number.isFinite(v) && v > 0 ? v : 25
  })
  const [gridMenu, setGridMenu] = useState(false)

  const lastVersion = useRef(0)
  const lastBlobUrl = useRef<string | null>(null)
  const didFit = useRef(false)

  const { viewportRef, stageRef, fit } = useViewport(pub?.width ?? 0, pub?.height ?? 0)

  const iconBtn =
    'inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-line bg-panel-2 text-bone transition hover:border-[#6a5232] hover:bg-[#352818]'

  useEffect(() => {
    let alive = true
    let unsub = () => {}

    const apply = (s: Snapshot) => {
      if (!alive || s.version <= lastVersion.current) return
      lastVersion.current = s.version
      const img = new Image()
      const finish = () => {
        if (!alive) return
        if (lastBlobUrl.current) URL.revokeObjectURL(lastBlobUrl.current)
        lastBlobUrl.current = s.imageUrl.startsWith('blob:') ? s.imageUrl : null
        setPins(s.pins)
        setPub({ version: s.version, width: s.width, height: s.height, src: s.imageUrl, fogOps: s.fogOps, grid: s.grid })
      }
      img.onload = finish
      img.onerror = () => setError('Could not load the map image.')
      img.src = s.imageUrl
      if (img.complete && img.naturalWidth > 0) finish()
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

  // fit on first published state
  useLayoutEffect(() => {
    if (pub && !didFit.current) {
      didFit.current = true
      fit()
    }
  }, [pub, fit])

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
      {pub?.grid?.enabled && (
        <div className="relative">
          <button className={iconBtn} onClick={() => setGridMenu((o) => !o)} title="Grid display">
            <Icon name="hexes" />
          </button>
          {gridMenu && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[240px] rounded-xl border border-line bg-gradient-to-b from-panel-2 to-panel p-3 shadow-2xl">
              <label className="flex items-center gap-2 font-ui text-[12px] text-bone">
                <input
                  type="checkbox"
                  checked={useGmGrid}
                  onChange={(e) => {
                    setUseGmGrid(e.target.checked)
                    localStorage.setItem('player-use-gm-grid', e.target.checked ? '1' : '0')
                  }}
                  className="accent-teal"
                />
                Use the GM&apos;s grid setting
              </label>
              <div
                className={`mt-2.5 flex items-center gap-2 ${useGmGrid ? 'pointer-events-none opacity-40' : ''}`}
              >
                <span className="font-ui text-[11px] text-bone-dim">Lines</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={playerGridOpacity}
                  onChange={(e) => {
                    const v = +e.target.value
                    setPlayerGridOpacity(v)
                    localStorage.setItem('player-grid-opacity', String(v))
                  }}
                  className="h-1 flex-1 cursor-pointer accent-teal"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={playerGridOpacity}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(100, Math.round(+e.target.value) || 0))
                    setPlayerGridOpacity(v)
                    localStorage.setItem('player-grid-opacity', String(v))
                  }}
                  className="w-12 rounded-[6px] border border-line bg-[#0f0b06] px-1.5 py-0.5 text-right font-ui text-[12px] text-teal outline-none focus:border-teal"
                />
              </div>
            </div>
          )}
        </div>
      )}
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
            <FogView
              width={pub.width}
              height={pub.height}
              mapSrc={pub.src}
              fogOps={pub.fogOps}
              grid={pub.grid}
              pins={pins}
              onReady={() => setFogReady(true)}
              gridOpacity={useGmGrid ? undefined : playerGridOpacity}
            />
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

        {/* hold a curtain over the map until the fog has actually painted, so the
            bare map is never shown and there's no re-apply flash */}
        {pub && (
          <div
            className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#16110b] transition-opacity duration-500 ${
              fogReady ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-[#3a2c1c] border-t-ochre [animation-duration:1.4s]" />
          </div>
        )}
      </div>
    </AppShell>
  )
}
