/**
 * The publish gate, as a swappable Backend.
 *
 * A Backend carries a published snapshot from GM to players and stores the map
 * image. Two implementations share one interface, so screens don't care which
 * is in use:
 *   - local  — IndexedDB snapshot + BroadcastChannel ping (one machine, no auth)
 *   - supabase — Storage for the image, published_state row + realtime (any device)
 *
 * The wire only ever carries PublicPin — the GM-only note never leaves the GM.
 */
import type { FogOp } from './fog.ts'
import { getPinColor, type Pin } from './pins.ts'
import type { GridSettings } from './types.ts'
import { idbGet, idbSet } from './storage.ts'
import { supabase } from './supabase.ts'

export type PublicPin = {
  id: string
  x: number
  y: number
  color: string
  icon: string
  title: string
  playerNote: string
}

/** Drop the GM-only note: it must never reach a player session. */
export const toPublicPins = (pins: Pin[]): PublicPin[] =>
  pins.map(({ id, x, y, title, playerNote, ...p }) => ({
    id,
    x,
    y,
    color: getPinColor(p),
    icon: p.icon || 'pin',
    title,
    playerNote,
  }))

/** What the GM hands to publish(). The image is uploaded separately via uploadMap. */
export type PublishInput = {
  version: number
  width: number
  height: number
  imageRef: string
  fogOps: FogOp[]
  pins: PublicPin[]
  grid: GridSettings | null
}

/** What a player receives. imageUrl is directly usable by <img>/canvas. */
export type Snapshot = {
  version: number
  width: number
  height: number
  imageUrl: string
  fogOps: FogOp[]
  pins: PublicPin[]
  grid: GridSettings | null
}

export interface Backend {
  /** Store the map image once; returns a reference used in publish(). */
  uploadMap(blob: Blob): Promise<string>
  publish(input: PublishInput): Promise<void>
  requestLatest(): Promise<Snapshot | undefined>
  subscribe(onUpdate: (s: Snapshot) => void): () => void
}

// ── local backend ─────────────────────────────────────────────────────────
const LOCAL_STATE = 'pub-state'
const LOCAL_IMAGE = 'pub-image'
const CHANNEL = 'stranded-publish'

type LocalState = Omit<PublishInput, 'imageRef'>

export function createLocalBackend(): Backend {
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null

  const readSnapshot = async (): Promise<Snapshot | undefined> => {
    const [state, blob] = await Promise.all([
      idbGet<LocalState>(LOCAL_STATE),
      idbGet<Blob>(LOCAL_IMAGE),
    ])
    if (!state || !blob) return undefined
    return { ...state, imageUrl: URL.createObjectURL(blob) }
  }

  return {
    async uploadMap(blob) {
      await idbSet(LOCAL_IMAGE, blob)
      return LOCAL_IMAGE
    },
    async publish(input) {
      const { version, width, height, fogOps, pins, grid } = input
      await idbSet(LOCAL_STATE, { version, width, height, fogOps, pins, grid } satisfies LocalState)
      bc?.postMessage({ type: 'published', version })
    },
    requestLatest: readSnapshot,
    subscribe(onUpdate) {
      const handler = async (e: MessageEvent) => {
        if (e.data?.type !== 'published') return
        const snap = await readSnapshot()
        if (snap) onUpdate(snap)
      }
      bc?.addEventListener('message', handler)
      return () => bc?.removeEventListener('message', handler)
    },
  }
}

// ── supabase backend ──────────────────────────────────────────────────────
const BUCKET = 'maps'

function extFor(blob: Blob): string {
  if (blob.type === 'image/png') return 'png'
  if (blob.type === 'image/jpeg') return 'jpg'
  if (blob.type === 'image/webp') return 'webp'
  if (blob.type === 'image/gif') return 'gif'
  return 'png'
}

export function createSupabaseBackend(roomId: string): Backend {
  const sb = supabase!
  const publicUrl = (path: string) => sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

  const rowToSnapshot = (row: {
    version: number
    width: number
    height: number
    image_path: string
    fog: FogOp[]
    pins: PublicPin[]
    grid: GridSettings | null
  }): Snapshot => ({
    version: Number(row.version),
    width: row.width,
    height: row.height,
    imageUrl: publicUrl(row.image_path),
    fogOps: row.fog ?? [],
    pins: row.pins ?? [],
    grid: row.grid ?? null,
  })

  return {
    async uploadMap(blob) {
      const path = `${roomId}/${Date.now()}.${extFor(blob)}`
      const { error } = await sb.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true, contentType: blob.type })
      if (error) throw error
      return path
    },

    async publish(input) {
      const base = {
        room_id: roomId,
        version: input.version,
        width: input.width,
        height: input.height,
        image_path: input.imageRef,
        fog: input.fogOps,
        pins: input.pins,
        updated_at: new Date().toISOString(),
      }
      let res = await sb.from('published_state').upsert({ ...base, grid: input.grid })
      // tolerate the grid column not existing yet (publish still works without it)
      if (res.error && /grid/i.test(res.error.message)) {
        res = await sb.from('published_state').upsert(base)
      }
      if (res.error) throw res.error
    },

    async requestLatest() {
      const { data } = await sb
        .from('published_state')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle()
      return data ? rowToSnapshot(data) : undefined
    },

    subscribe(onUpdate) {
      const channel = sb
        .channel(`room:${roomId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'published_state', filter: `room_id=eq.${roomId}` },
          (payload) => {
            const row = payload.new as Parameters<typeof rowToSnapshot>[0]
            if (row?.image_path) onUpdate(rowToSnapshot(row))
          },
        )
        .subscribe()
      return () => {
        void sb.removeChannel(channel)
      }
    },
  }
}
