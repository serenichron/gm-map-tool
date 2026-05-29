import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AppShell } from '../components/AppShell.tsx'
import { Viewport } from '../components/Viewport.tsx'
import { PinMarker } from '../components/PinMarker.tsx'
import { PinEditor } from '../components/PinEditor.tsx'
import { RoomMenu } from '../components/RoomMenu.tsx'
import { HexGrid } from '../components/HexGrid.tsx'
import { MapFrame } from '../components/MapFrame.tsx'
import { Icon } from '../components/icons.tsx'
import { useViewport } from '../hooks/useViewport.ts'
import { FogController, type FogTool } from '../lib/fog.ts'
import { pixelToHex } from '../lib/hex.ts'
import { newPinId, type Pin } from '../lib/pins.ts'
import { idbGet, idbSet, idbDel, imgKey, workKey, type WorkingState } from '../lib/storage.ts'
import {
  createLocalBackend,
  createSupabaseBackend,
  toPublicPins,
  type Backend,
} from '../lib/transport.ts'
import { hasSupabase } from '../lib/supabase.ts'
import { ensureSession } from '../lib/session.ts'
import { createRoom, listRooms, renameRoom, deleteRoom, type Room } from '../lib/rooms.ts'
import type { LoadedMap } from '../lib/types.ts'

type Tool = 'pan' | FogTool | 'pin' | 'tile'

const GM_FOG_OPACITY = 0.66
const LOCAL_ROOM = 'local' // single-room id when Supabase isn't configured
const ACTIVE_ROOM_KEY = 'stranded-active-room'

const BRUSH_CURSOR_COLOR: Record<FogTool, string> = {
  reveal: '#e0a94b',
  hide: '#a8503a',
  semi: '#3e8e89',
}

// Soft access gate for the GM screen. The password lives in the client, so this
// only deters casual access — real protection would need server-side auth.
const GM_PASSWORD = '123456'
const GM_UNLOCK_KEY = 'stranded-gm-unlocked'

export function GMScreen() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(GM_UNLOCK_KEY) === '1')
  if (!unlocked) return <GmGate onUnlock={() => setUnlocked(true)} />
  return <GMWorkspace />
}

function GmGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)
  const submit = () => {
    if (pw === GM_PASSWORD) {
      localStorage.setItem(GM_UNLOCK_KEY, '1')
      onUnlock()
    } else {
      setError(true)
    }
  }
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <div className="w-[min(380px,92vw)] rounded-[18px] border border-line bg-gradient-to-b from-panel-2 to-panel p-8 text-center shadow-2xl">
        <div className="font-ui text-[11px] uppercase tracking-[0.32em] text-ochre/85">GM screen</div>
        <h1 className="mt-2 mb-5 font-display text-[26px] font-extrabold text-bone">Keeper's word</h1>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => {
            setPw(e.target.value)
            setError(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Password"
          className={`w-full rounded-xl border bg-[#0f0b06] px-4 py-3 text-center font-ui text-[15px] tracking-[0.2em] text-bone outline-none ${
            error ? 'border-rust' : 'border-line focus:border-ochre'
          }`}
        />
        {error && <p className="mt-2 font-ui text-[12px] text-rust">Wrong word. The dust stays.</p>}
        <button
          onClick={submit}
          className="mt-4 w-full rounded-xl border border-ochre bg-gradient-to-b from-[#3a2a18] to-[#2a1f13] px-5 py-3 font-ui text-[15px] font-semibold text-bone transition hover:-translate-y-0.5"
        >
          Enter
        </button>
      </div>
    </div>
  )
}

function GMWorkspace() {
  const [map, setMap] = useState<LoadedMap | null>(null)
  const [tool, setTool] = useState<Tool>('reveal')
  const [brush, setBrush] = useState(30)
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [pins, setPins] = useState<Pin[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gridOn, setGridOn] = useState(false)
  const [gridSize, setGridSize] = useState(37)
  const [tileAction, setTileAction] = useState<FogTool>('reveal')
  const [dirty, setDirty] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fogRef = useRef<FogController>(null as unknown as FogController)
  if (!fogRef.current) fogRef.current = new FogController()
  const backendRef = useRef<Backend | null>(null)
  const mapBlobRef = useRef<Blob | null>(null)
  const uploadedRef = useRef<string | null>(null)
  const uploadedBlobRef = useRef<Blob | null>(null)
  const gmIdRef = useRef<string | null>(null)

  const fogCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)

  // mirrors for native listeners / async work
  const toolRef = useRef(tool)
  toolRef.current = tool
  const brushRef = useRef(brush)
  brushRef.current = brush
  const mapRef = useRef(map)
  mapRef.current = map
  const pinsRef = useRef(pins)
  pinsRef.current = pins
  const gridOnRef = useRef(gridOn)
  gridOnRef.current = gridOn
  const gridSizeRef = useRef(gridSize)
  gridSizeRef.current = gridSize
  const tileActionRef = useRef(tileAction)
  tileActionRef.current = tileAction
  const activeRoomIdRef = useRef(activeRoomId)
  activeRoomIdRef.current = activeRoomId

  const restoredOps = useRef<WorkingState['fogOps'] | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null

  const refreshUndo = () => {
    setCanUndo(fogRef.current.canUndo())
    setCanRedo(fogRef.current.canRedo())
  }

  const buildWorking = (): WorkingState | null => {
    const m = mapRef.current
    if (!m) return null
    return {
      width: m.width,
      height: m.height,
      fogOps: fogRef.current.getActiveOps(),
      pins: pinsRef.current,
      grid: { enabled: gridOnRef.current, size: gridSizeRef.current },
    }
  }

  // any GM edit: mark unpublished changes + autosave the active room's draft
  const scheduleSave = () => {
    setDirty(true)
    clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      const id = activeRoomIdRef.current
      const w = buildWorking()
      if (id && w) void idbSet(workKey(id), w)
    }, 400)
  }

  // flush the current draft immediately (before switching rooms)
  const saveNow = async () => {
    const id = activeRoomIdRef.current
    const w = buildWorking()
    if (id && w) await idbSet(workKey(id), w)
  }

  const { viewportRef, stageRef, view, fit, screenToImage } = useViewport(
    map?.width ?? 0,
    map?.height ?? 0,
    {
      onScaleChange: setZoom,
      shouldPan: (e) => e.button !== 0 || toolRef.current === 'pan',
      onPaintStart: (pt) => {
        const t = toolRef.current
        if (t === 'pan') return
        if (t === 'pin') {
          addPin(pt.x, pt.y)
          return
        }
        if (t === 'tile') {
          const seed = Math.floor(Math.random() * 0xffffffff)
          fogRef.current.beginHexBatch(tileActionRef.current, gridSizeRef.current, seed)
          const c = pixelToHex(pt.x, pt.y, gridSizeRef.current)
          fogRef.current.addHexCell(c.col, c.row)
          return
        }
        const r = brushRef.current / 2 / view.current.s
        const seed = Math.floor(Math.random() * 0xffffffff)
        fogRef.current.beginStroke(t, r, seed)
        fogRef.current.extendStroke(pt.x, pt.y)
      },
      onPaintMove: (pt) => {
        const t = toolRef.current
        if (t === 'pan' || t === 'pin') return
        if (t === 'tile') {
          const c = pixelToHex(pt.x, pt.y, gridSizeRef.current)
          fogRef.current.addHexCell(c.col, c.row)
          return
        }
        fogRef.current.extendStroke(pt.x, pt.y)
      },
      onPaintEnd: () => {
        const t = toolRef.current
        if (t === 'pin') return
        if (t === 'tile') {
          fogRef.current.endHexBatch()
        } else {
          fogRef.current.endStroke()
        }
        refreshUndo()
        scheduleSave()
      },
    },
  )

  // sign in + load the GM's rooms (or fall back to a single local room)
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!hasSupabase) {
        backendRef.current = createLocalBackend()
        setActiveRoomId(LOCAL_ROOM)
        return
      }
      const uid = await ensureSession()
      if (!alive) return
      if (!uid) {
        backendRef.current = createLocalBackend()
        setActiveRoomId(LOCAL_ROOM)
        return
      }
      gmIdRef.current = uid
      let list = await listRooms(uid)
      if (!alive) return
      if (list.length === 0) {
        const r = await createRoom(uid, 'My table')
        if (r) list = [r]
      }
      setRooms(list)
      const saved = localStorage.getItem(ACTIVE_ROOM_KEY)
      setActiveRoomId(saved && list.some((r) => r.id === saved) ? saved : (list[0]?.id ?? null))
    })()
    return () => {
      alive = false
    }
  }, [])

  // when the active room changes: bind its backend and load its saved draft
  useEffect(() => {
    if (!activeRoomId) return
    backendRef.current =
      hasSupabase && activeRoomId !== LOCAL_ROOM
        ? createSupabaseBackend(activeRoomId)
        : createLocalBackend()
    uploadedRef.current = null
    uploadedBlobRef.current = null
    if (activeRoomId !== LOCAL_ROOM) localStorage.setItem(ACTIVE_ROOM_KEY, activeRoomId)

    let alive = true
    ;(async () => {
      const [img, working] = await Promise.all([
        idbGet<Blob>(imgKey(activeRoomId)),
        idbGet<WorkingState>(workKey(activeRoomId)),
      ])
      if (!alive) return
      if (img && working) {
        restoredOps.current = working.fogOps
        mapBlobRef.current = img
        setPins(working.pins ?? [])
        setGridOn(working.grid?.enabled ?? false)
        setGridSize(working.grid?.size ?? 37)
        setSelectedId(null)
        setMap({ src: URL.createObjectURL(img), width: working.width, height: working.height })
      } else {
        restoredOps.current = null
        mapBlobRef.current = null
        setPins([])
        setGridOn(false)
        setGridSize(37)
        setSelectedId(null)
        setMap(null)
      }
      setDirty(false)
    })()
    return () => {
      alive = false
    }
  }, [activeRoomId])

  // release object URL on replace / unmount
  useEffect(() => {
    return () => {
      if (map) URL.revokeObjectURL(map.src)
    }
  }, [map])

  // attach the fog canvas; restore saved fog, or cover a fresh map
  useLayoutEffect(() => {
    if (!map) return
    const canvas = fogCanvasRef.current
    if (!canvas) return
    fogRef.current.attach(canvas, map.width, map.height)
    if (restoredOps.current) {
      fogRef.current.setOps(restoredOps.current)
      restoredOps.current = null
    } else {
      fogRef.current.reset('covered')
    }
    refreshUndo()
    fit()
  }, [map, fit])

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.matches('input, textarea')) return
      const meta = e.ctrlKey || e.metaKey
      if (meta && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) fogRef.current.redo()
        else fogRef.current.undo()
        refreshUndo()
        scheduleSave()
      } else if (meta && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        fogRef.current.redo()
        refreshUndo()
        scheduleSave()
      } else if (e.key === 'f' || e.key === 'F') fit()
      else if (e.key === '1') setTool('pan')
      else if (e.key === '2') setTool('reveal')
      else if (e.key === '3') setTool('semi')
      else if (e.key === '4') setTool('hide')
      else if (e.key === '5') setTool('pin')
      else if (e.key === '6') setTool('tile')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fit])

  // the Tile tool needs the grid visible to aim at; turn it on when chosen
  useEffect(() => {
    if (tool === 'tile' && !gridOn) {
      setGridOn(true)
      scheduleSave()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool])

  function loadFile(file: File | undefined | null) {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const id = activeRoomIdRef.current
      restoredOps.current = null
      mapBlobRef.current = file
      uploadedBlobRef.current = null
      setPins([])
      setSelectedId(null)
      setMap({ src: url, width: img.naturalWidth, height: img.naturalHeight })
      if (id) void idbSet(imgKey(id), file)
      scheduleSave()
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }

  // pin operations
  function addPin(x: number, y: number) {
    const pin: Pin = { id: newPinId(), x, y, domain: 'amber', title: '', playerNote: '', gmNote: '' }
    setPins((p) => [...p, pin])
    setSelectedId(pin.id)
    scheduleSave()
  }
  function movePin(id: string, x: number, y: number) {
    const m = mapRef.current
    if (!m) return
    const cx = Math.max(0, Math.min(m.width, x))
    const cy = Math.max(0, Math.min(m.height, y))
    setPins((p) => p.map((pin) => (pin.id === id ? { ...pin, x: cx, y: cy } : pin)))
    scheduleSave()
  }
  function patchPin(id: string, patch: Partial<Pin>) {
    setPins((p) => p.map((pin) => (pin.id === id ? { ...pin, ...patch } : pin)))
    scheduleSave()
  }
  function deletePin(id: string) {
    setPins((p) => p.filter((pin) => pin.id !== id))
    setSelectedId(null)
    scheduleSave()
  }

  // room operations
  async function switchRoom(id: string) {
    if (id === activeRoomId) return
    await saveNow()
    setActiveRoomId(id)
  }
  async function createNewRoom(name: string) {
    const uid = gmIdRef.current
    if (!uid) return
    await saveNow()
    const r = await createRoom(uid, name)
    if (r) {
      setRooms((rs) => [...rs, r])
      setActiveRoomId(r.id)
    }
  }
  function rename(id: string, name: string) {
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, name } : r)))
    void renameRoom(id, name)
  }
  async function removeRoom(id: string) {
    await deleteRoom(id)
    void idbDel(workKey(id))
    void idbDel(imgKey(id))
    const remaining = rooms.filter((r) => r.id !== id)
    setRooms(remaining)
    if (activeRoomId === id) {
      if (remaining.length) setActiveRoomId(remaining[0].id)
      else {
        const uid = gmIdRef.current
        const r = uid ? await createRoom(uid, 'My table') : null
        if (r) {
          setRooms([r])
          setActiveRoomId(r.id)
        }
      }
    }
  }

  // push the current map, fog and pins to players (GM notes are stripped)
  async function publish() {
    const m = mapRef.current
    const blob = mapBlobRef.current
    const backend = backendRef.current
    if (!m || !blob || !backend) return
    setPublishing(true)
    try {
      if (blob !== uploadedBlobRef.current) {
        uploadedRef.current = await backend.uploadMap(blob)
        uploadedBlobRef.current = blob
      }
      await backend.publish({
        version: Date.now(),
        width: m.width,
        height: m.height,
        imageRef: uploadedRef.current!,
        fogOps: fogRef.current.getActiveOps(),
        pins: toPublicPins(pinsRef.current),
        grid: { enabled: gridOnRef.current, size: gridSizeRef.current },
      })
      setDirty(false)
    } catch (e) {
      console.error('publish failed:', e)
    } finally {
      setPublishing(false)
    }
  }

  // export every room's draft (map image + fog + pins + grid) to a JSON file
  async function exportRooms() {
    await saveNow()
    const out: {
      app: string
      version: number
      exportedAt: string
      rooms: unknown[]
    } = { app: 'worldsmith', version: 1, exportedAt: new Date().toISOString(), rooms: [] }
    for (const r of rooms) {
      const [img, working] = await Promise.all([
        idbGet<Blob>(imgKey(r.id)),
        idbGet<WorkingState>(workKey(r.id)),
      ])
      if (!working) continue
      const image = img
        ? await new Promise<string>((res) => {
            const fr = new FileReader()
            fr.onload = () => res(fr.result as string)
            fr.readAsDataURL(img)
          })
        : null
      out.rooms.push({
        name: r.name,
        joinCode: r.join_code,
        width: working.width,
        height: working.height,
        fogOps: working.fogOps,
        pins: working.pins,
        grid: working.grid ?? null,
        image,
      })
    }
    const blob = new Blob([JSON.stringify(out)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `worldsmith-rooms-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // recreate rooms from an exported file (as new rooms with fresh codes)
  async function importRooms(file: File) {
    let data: { app?: string; rooms?: Record<string, unknown>[] }
    try {
      data = JSON.parse(await file.text())
    } catch {
      window.alert('Could not read that file.')
      return
    }
    if (data.app !== 'worldsmith' || !Array.isArray(data.rooms)) {
      window.alert('That is not a Worldsmith export.')
      return
    }
    const uid = gmIdRef.current
    await saveNow()
    let firstId: string | null = null
    let added: Room[] = []
    for (const r of data.rooms) {
      let id: string
      if (hasSupabase && uid) {
        const room = await createRoom(uid, (r.name as string) || 'Imported room')
        if (!room) continue
        id = room.id
        added = [...added, room]
      } else {
        id = LOCAL_ROOM
      }
      if (typeof r.image === 'string') {
        const b = await (await fetch(r.image)).blob()
        await idbSet(imgKey(id), b)
      }
      await idbSet(workKey(id), {
        width: r.width as number,
        height: r.height as number,
        fogOps: (r.fogOps as WorkingState['fogOps']) ?? [],
        pins: (r.pins as WorkingState['pins']) ?? [],
        grid: (r.grid as WorkingState['grid']) ?? null,
      })
      if (!firstId) firstId = id
    }
    if (added.length) setRooms((rs) => [...rs, ...added])
    if (firstId) setActiveRoomId(firstId)
    window.alert(`Imported ${data.rooms.length} room(s).`)
  }

  async function copyPlayerLink() {
    if (!activeRoom) return
    // base-aware hash link, works on localhost, LAN, and GitHub Pages alike
    const link = `${location.origin}${location.pathname}#/room?c=${activeRoom.join_code}`
    let ok = false
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link)
        ok = true
      }
    } catch {
      /* fall through */
    }
    if (!ok) {
      // clipboard API is blocked on plain http (LAN IP); use a temp textarea
      try {
        const ta = document.createElement('textarea')
        ta.value = link
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        ok = false
      }
    }
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } else {
      // last resort: show it so the GM can copy by hand
      window.prompt('Copy the player link:', link)
    }
  }

  const pickFile = () => fileRef.current?.click()
  const selectedPin = pins.find((p) => p.id === selectedId) ?? null

  const isBrush = tool === 'reveal' || tool === 'hide' || tool === 'semi'
  const cursorClass = tool === 'pan' ? 'cursor-grab' : isBrush ? 'cursor-none' : 'cursor-crosshair'

  function moveCursor(e: React.PointerEvent) {
    const el = cursorRef.current
    const ws = workspaceRef.current
    if (!el || !ws) return
    if (!isBrush || !map) {
      el.style.display = 'none'
      return
    }
    const rect = ws.getBoundingClientRect()
    el.style.display = 'block'
    el.style.width = `${brush}px`
    el.style.height = `${brush}px`
    el.style.borderColor = BRUSH_CURSOR_COLOR[tool as FogTool]
    el.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px) translate(-50%, -50%)`
  }

  const iconBtn =
    'inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-line bg-panel-2 text-bone transition hover:border-[#6a5232] hover:bg-[#352818] disabled:opacity-35 disabled:cursor-default disabled:hover:border-line disabled:hover:bg-panel-2'

  // primary mode button (icon + label; label hidden on small screens)
  const modeBtn = (t: Tool, icon: string, label: string, title: string) => (
    <button
      key={t}
      onClick={() => setTool(t)}
      title={title}
      className={`inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 font-ui text-[13px] font-medium transition ${
        tool === t
          ? 'bg-gradient-to-b from-[#3f2e1a] to-[#30230f] text-gold shadow-[inset_0_0_0_1px_rgba(224,169,75,.55)]'
          : 'text-bone-dim hover:bg-[#352818] hover:text-bone'
      }`}
    >
      <Icon name={icon} className="h-[17px] w-[17px]" />
      <span className="hidden md:inline">{label}</span>
    </button>
  )

  // lighter ghost button for secondary utilities
  const utilBtn =
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-bone-dim transition hover:bg-[#352818] hover:text-bone disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-bone-dim'

  // top row: load map, room, share, publish
  const topRight = (
    <div className="flex items-center gap-2">
      <button className={iconBtn} onClick={pickFile} title="Load a map image">
        <Icon name="map" />
      </button>
      {activeRoom && (
        <>
          <RoomMenu
            rooms={rooms}
            activeId={activeRoomId}
            onSwitch={switchRoom}
            onCreate={createNewRoom}
            onRename={rename}
            onDelete={removeRoom}
            onExport={() => void exportRooms()}
            onImport={() => importRef.current?.click()}
          />
          <button className={iconBtn} onClick={() => void copyPlayerLink()} title="Copy the player join link">
            <Icon name={copied ? 'check' : 'copy'} />
          </button>
        </>
      )}
      {map && (
        <button
          onClick={() => void publish()}
          disabled={publishing}
          title={dirty ? 'You have unpublished changes' : 'Players are up to date'}
          className={`rounded-[10px] border px-4 py-2 font-ui text-[13px] font-bold tracking-[0.02em] transition disabled:opacity-60 ${
            dirty
              ? 'animate-pulse border-fog-warn bg-gradient-to-b from-[#b8632f] to-[#8c481f] text-[#fff3e6]'
              : 'border-teal bg-gradient-to-b from-teal-dim to-[#1e4744] text-[#dff2f0]'
          }`}
        >
          {publishing ? 'Publishing…' : dirty ? 'Publish •' : 'Published'}
        </button>
      )}
    </div>
  )

  // a recessed inset panel for the active tool's options
  const optionPanel = 'flex items-center gap-2.5 rounded-[10px] bg-black/25 px-3 py-1.5 ring-1 ring-inset ring-line/70'
  const optionLabel = 'font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-ochre/80'
  const vDivider = 'mx-1.5 h-6 w-px shrink-0 bg-line/70'

  // tools row (only with a map): mode picker · contextual options · utilities
  const toolbar = map ? (
    <>
      {/* PRIMARY — what the pointer does, grouped: navigate · fog brushes · pin · tiles */}
      <div className="flex items-center gap-0.5 rounded-[11px] border border-line bg-ink-2 p-1">
        {modeBtn('pan', 'pan', 'Pan', 'Pan / move (1)')}
        <span className="mx-0.5 h-5 w-px bg-line/60" />
        {modeBtn('reveal', 'reveal', 'Reveal', 'Reveal fog (2)')}
        {modeBtn('semi', 'semi', 'Semi', 'Semi-reveal — torn glimpse (3)')}
        {modeBtn('hide', 'hide', 'Hide', 'Re-cover with fog (4)')}
        <span className="mx-0.5 h-5 w-px bg-line/60" />
        {modeBtn('pin', 'pin', 'Pin', 'Place a pin (5)')}
        <span className="mx-0.5 h-5 w-px bg-line/60" />
        {modeBtn('tile', 'tile', 'Tile', 'Hex tiles (6)')}
      </div>

      {/* grid on/off — sits next to the tile control */}
      <button
        onClick={() => { setGridOn((v) => !v); scheduleSave() }}
        title="Show / hide the hex grid"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-[9px] border transition ${
          gridOn
            ? 'border-ochre bg-ochre/10 text-gold'
            : 'border-line bg-panel-2 text-bone-dim hover:bg-[#352818] hover:text-bone'
        }`}
      >
        <Icon name="hexes" />
      </button>

      {/* CONTEXTUAL — options for the active tool */}
      {isBrush && (
        <div className={optionPanel}>
          <span className={optionLabel}>Brush</span>
          <input
            type="range"
            min={20}
            max={120}
            value={brush}
            onChange={(e) => setBrush(+e.target.value)}
            className="h-1 w-24 cursor-pointer accent-gold"
          />
          <span className="min-w-[24px] text-right font-ui text-[11px] text-gold">{brush}</span>
        </div>
      )}

      {tool === 'tile' && (
        <div className={optionPanel}>
          <span className={optionLabel}>Tile</span>
          <div className="flex items-center gap-0.5 rounded-md bg-ink-2 p-0.5">
            {(
              [
                ['reveal', 'Clear'],
                ['semi', 'Partial'],
                ['hide', 'Cover'],
              ] as [FogTool, string][]
            ).map(([a, label]) => (
              <button
                key={a}
                onClick={() => setTileAction(a)}
                className={`rounded px-2.5 py-1 font-ui text-[12px] font-medium transition ${
                  tileAction === a
                    ? 'bg-gradient-to-b from-[#3f2e1a] to-[#30230f] text-gold'
                    : 'text-bone-dim hover:bg-[#352818] hover:text-bone'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={20}
            max={87}
            value={gridSize}
            onChange={(e) => {
              setGridSize(+e.target.value)
              scheduleSave()
            }}
            className="h-1 w-16 cursor-pointer accent-gold"
          />
          <input
            type="number"
            min={10}
            max={400}
            value={gridSize}
            onChange={(e) => {
              const v = Math.max(10, Math.min(400, Math.round(+e.target.value) || 10))
              setGridSize(v)
              scheduleSave()
            }}
            className="w-12 rounded-[6px] border border-line bg-[#0f0b06] px-1.5 py-0.5 text-right font-ui text-[12px] text-gold outline-none focus:border-ochre"
          />
        </div>
      )}

      <div className="flex-1" />

      {/* SECONDARY — utilities, grouped and lighter */}
      <div className="flex items-center gap-0.5">
        <button className={utilBtn} disabled={!canUndo} onClick={() => { fogRef.current.undo(); refreshUndo(); scheduleSave() }} title="Undo (Ctrl+Z)">
          <Icon name="undo" />
        </button>
        <button className={utilBtn} disabled={!canRedo} onClick={() => { fogRef.current.redo(); refreshUndo(); scheduleSave() }} title="Redo (Ctrl+Shift+Z)">
          <Icon name="redo" />
        </button>
      </div>

      <span className={vDivider} />

      <div className="flex items-center gap-0.5">
        <button
          className={utilBtn}
          onClick={() => {
            if (!window.confirm('Cover the whole map with fog?')) return
            fogRef.current.fill('covered')
            refreshUndo()
            scheduleSave()
          }}
          title="Cover the whole map"
        >
          <Icon name="coverAll" />
        </button>
        <button
          className={utilBtn}
          onClick={() => {
            if (!window.confirm('Clear all fog? This reveals the entire map.')) return
            fogRef.current.fill('clear')
            refreshUndo()
            scheduleSave()
          }}
          title="Clear all fog"
        >
          <Icon name="revealAll" />
        </button>
      </div>

      <span className={vDivider} />

      <div className="flex items-center gap-1">
        <span className="min-w-[38px] text-center font-ui text-[11px] text-bone-dim">
          {Math.round(zoom * 100)}%
        </span>
        <button className={utilBtn} onClick={() => fit()} title="Fit to screen (F)">
          <Icon name="fit" />
        </button>
      </div>
    </>
  ) : undefined

  return (
    <AppShell role="gm" topRight={topRight} toolbar={toolbar}>
      <div
        ref={workspaceRef}
        className="relative flex flex-1 bg-[radial-gradient(130%_100%_at_50%_30%,#241a11_0%,#140e08_70%,#0a0704_100%)]"
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          loadFile(Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/')))
        }}
        onPointerMove={moveCursor}
        onPointerLeave={() => {
          if (cursorRef.current) cursorRef.current.style.display = 'none'
        }}
      >
        {map ? (
          <>
            <Viewport
              viewportRef={viewportRef}
              stageRef={stageRef}
              src={map.src}
              width={map.width}
              height={map.height}
              cursorClass={cursorClass}
            >
              <canvas
                key={map.src}
                ref={fogCanvasRef}
                width={map.width}
                height={map.height}
                className="pointer-events-none absolute left-0 top-0"
                style={{ width: map.width, height: map.height, opacity: GM_FOG_OPACITY }}
              />
              {gridOn && (
                <HexGrid
                  width={map.width}
                  height={map.height}
                  size={gridSize}
                  color="rgba(232,183,94,0.3)"
                  color2="rgba(153,112,51,0.3)"
                />
              )}
              <div className="pointer-events-none absolute left-0 top-0" style={{ width: map.width, height: map.height }}>
                {pins.map((p) => (
                  <PinMarker
                    key={p.id}
                    pin={p}
                    interactive
                    screenToImage={screenToImage}
                    onMove={movePin}
                    onOpen={setSelectedId}
                  />
                ))}
              </div>
              <MapFrame width={map.width} height={map.height} />
            </Viewport>
            <div
              ref={cursorRef}
              className="pointer-events-none absolute left-0 top-0 z-10 hidden rounded-full border-[1.5px]"
              style={{ boxShadow: '0 0 0 1px rgba(0,0,0,.5), inset 0 0 12px rgba(224,169,75,.25)' }}
            />
          </>
        ) : (
          <div className="pointer-events-none flex flex-1 items-center justify-center">
            <div className={`flex flex-col items-center gap-4 rounded-2xl p-10 text-center transition ${dragging ? 'bg-ochre/[0.06]' : ''}`}>
              <div className="flex h-[108px] w-[108px] items-center justify-center rounded-full border-2 border-dashed border-[#5a4226] bg-[radial-gradient(circle,rgba(224,169,75,.08),transparent_70%)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-12 w-12 text-ochre/80">
                  <path d="M4 16l5-5 4 4 3-3 4 4" />
                  <path d="M3 5h18v14H3z" />
                  <circle cx="8.5" cy="9" r="1.4" />
                </svg>
              </div>
              <h3 className="font-display text-[22px] font-semibold text-bone">Load your map</h3>
              <p className="max-w-[360px] font-ui text-[13px] leading-relaxed text-bone-dim">
                Drag an image here, or{' '}
                <span className="pointer-events-auto cursor-pointer text-gold underline" onClick={pickFile}>
                  choose a file
                </span>
                . Fog will cover it. Reveal what the table should see; the dust clears only where you brush.
              </p>
            </div>
          </div>
        )}
      </div>

      {selectedPin && (
        <PinEditor
          pin={selectedPin}
          onPatch={(patch) => patchPin(selectedPin.id, patch)}
          onDelete={() => deletePin(selectedPin.id)}
          onClose={() => setSelectedId(null)}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          loadFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void importRooms(f)
          e.target.value = ''
        }}
      />
    </AppShell>
  )
}
