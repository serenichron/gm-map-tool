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
import { getPinColor, isShared, type Disposition, type NpcStatus, type Pin } from './pins.ts'
import { DEFAULT_HAZE, type HazeStyle } from './fogStyle.ts'
import type { GridSettings } from './types.ts'
import { idbGet, idbSet } from './storage.ts'
import { supabase } from './supabase.ts'

export type PublicPin = {
  id: string
  x: number
  y: number
  color: string
  icon: string
  borderColor?: string
  labelBg?: string
  aboveFog?: boolean
  labelAboveFog?: boolean
  title: string
  playerNote: string
  // NPC (only present when kind === 'npc'); unshared fields are omitted
  kind?: 'place' | 'npc'
  portrait?: string
  role?: string
  disposition?: Disposition
  status?: NpcStatus
}

/** Drop the GM-only note, GM-only pins, and any NPC field not shared with players. */
export const toPublicPins = (pins: Pin[]): PublicPin[] =>
  pins
    .filter((p) => !p.gmOnly)
    .map(({ id, x, y, title, playerNote, ...p }) => {
      const base: PublicPin = {
        id,
        x,
        y,
        color: getPinColor(p),
        icon: p.icon || 'pin',
        borderColor: p.borderColor,
        labelBg: p.labelBg,
        aboveFog: p.aboveFog,
        labelAboveFog: p.labelAboveFog,
        title,
        playerNote,
      }
      if (p.kind !== 'npc') return base
      return {
        ...base,
        kind: 'npc',
        portrait: p.portrait,
        role: isShared(p, 'role') ? p.role : undefined,
        disposition: isShared(p, 'disposition') ? p.disposition : undefined,
        status: isShared(p, 'status') ? p.status : undefined,
      }
    })

/** What the GM hands to publish(). The image is uploaded separately via uploadMap. */
export type PublishInput = {
  version: number
  width: number
  height: number
  imageRef: string
  fogOps: FogOp[]
  pins: PublicPin[]
  grid: GridSettings | null
  cloud: HazeStyle
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
  cloud: HazeStyle
}

export interface Backend {
  /** Store the (veiled) image; returns a reference used in publish(). Pass a
   *  stable `name` to overwrite the same object each publish instead of piling
   *  up files (the snapshot URL is cache-busted by version). */
  uploadMap(blob: Blob, name?: string): Promise<string>
  publish(input: PublishInput): Promise<void>
  requestLatest(): Promise<Snapshot | undefined>
  subscribe(onUpdate: (s: Snapshot) => void): () => void
  /** Delete every stored image for this room except the given paths to keep —
   *  clears orphaned files so nothing piles up. No-op for the local backend. */
  pruneStorage(keep: string[]): Promise<void>
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
    return { ...state, cloud: state.cloud ?? DEFAULT_HAZE, imageUrl: URL.createObjectURL(blob) }
  }

  return {
    async uploadMap(blob, _name) {
      await idbSet(LOCAL_IMAGE, blob)
      return LOCAL_IMAGE
    },
    async publish(input) {
      const { version, width, height, fogOps, pins, grid, cloud } = input
      await idbSet(LOCAL_STATE, { version, width, height, fogOps, pins, grid, cloud } satisfies LocalState)
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
    async pruneStorage() {
      /* single in-place blob; nothing to prune */
    },
  }
}

// ── supabase backend ──────────────────────────────────────────────────────
const BUCKET = 'maps'

const bust = (url: string, v: number) => `${url}${url.includes('?') ? '&' : '?'}v=${v}`

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
    style?: HazeStyle | null
  }): Snapshot => ({
    version: Number(row.version),
    width: row.width,
    height: row.height,
    // cache-bust by version so a stable image path (overwritten each publish)
    // still refreshes on players' screens
    imageUrl: bust(publicUrl(row.image_path), Number(row.version)),
    fogOps: row.fog ?? [],
    pins: row.pins ?? [],
    grid: row.grid ?? null,
    cloud: row.style ?? DEFAULT_HAZE,
  })

  return {
    async uploadMap(blob, name) {
      const path = `${roomId}/${name ?? Date.now()}.${extFor(blob)}`
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
      let res = await sb.from('published_state').upsert({ ...base, grid: input.grid, style: input.cloud })
      // tolerate optional columns (grid/style) not existing yet
      if (res.error && /style|grid/i.test(res.error.message)) {
        res = await sb.from('published_state').upsert({ ...base, grid: input.grid })
        if (res.error && /grid/i.test(res.error.message)) {
          res = await sb.from('published_state').upsert(base)
        }
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

    async pruneStorage(keep) {
      // never mass-delete on a bad/empty keep set (would wipe the live image)
      const keepSet = new Set(keep.filter(Boolean))
      if (keepSet.size === 0) return
      const { data, error } = await sb.storage.from(BUCKET).list(roomId, { limit: 1000 })
      if (error || !data) return
      const remove = data
        .filter((o) => o.name)
        .map((o) => `${roomId}/${o.name}`)
        .filter((path) => !keepSet.has(path))
      if (remove.length) await sb.storage.from(BUCKET).remove(remove)
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
