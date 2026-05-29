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
      img.onload = () => {
        if (!alive) return
        if (lastBlobUrl.current) URL.revokeObjectURL(lastBlobUrl.current)
        lastBlobUrl.current = s.imageUrl.startsWith('blob:') ? s.imageUrl : null
        setPins(s.pins)
        setPub({ version: s.version, width: s.width, height: s.height, src: s.imageUrl, fogOps: s.fogOps, grid: s.grid })
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
      </div>
    </AppShell>
  )
}
