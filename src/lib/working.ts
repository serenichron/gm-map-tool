/**
 * The GM's private working draft, synced across the GM's own devices via a
 * gm_working_state row (RLS: room's GM only) + realtime. Image lives in Storage.
 * Includes GM-only pin notes — safe because the row is GM-only.
 */
import { supabase } from './supabase.ts'
import type { FogOp } from './fog.ts'
import type { Pin } from './pins.ts'
import type { GridSettings } from './types.ts'

const BUCKET = 'maps'

export type CloudWorking = {
  version: number
  editor: string
  width: number
  height: number
  imagePath: string
  imageUrl: string
  fog: FogOp[]
  pins: Pin[]
  grid: GridSettings | null
}

const extFor = (b: Blob) =>
  b.type === 'image/jpeg' ? 'jpg' : b.type === 'image/webp' ? 'webp' : b.type === 'image/gif' ? 'gif' : 'png'

export async function uploadWorkingImage(roomId: string, blob: Blob): Promise<string | null> {
  if (!supabase) return null
  const path = `${roomId}/work-${Date.now()}.${extFor(blob)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type,
  })
  if (error) {
    console.error('uploadWorkingImage:', error.message)
    return null
  }
  return path
}

export async function saveWorkingState(row: {
  room_id: string
  version: number
  editor: string
  width: number
  height: number
  image_path: string
  fog: FogOp[]
  pins: Pin[]
  grid: GridSettings | null
}): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('gm_working_state')
    .upsert({ ...row, updated_at: new Date().toISOString() })
  if (error) console.error('saveWorkingState:', error.message)
}

const publicUrl = (path: string) =>
  supabase!.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

type Row = {
  version: number
  editor: string
  width: number
  height: number
  image_path: string
  fog: FogOp[]
  pins: Pin[]
  grid: GridSettings | null
}

const toCloud = (r: Row): CloudWorking => ({
  version: Number(r.version),
  editor: r.editor,
  width: r.width,
  height: r.height,
  imagePath: r.image_path,
  imageUrl: publicUrl(r.image_path),
  fog: r.fog ?? [],
  pins: r.pins ?? [],
  grid: r.grid ?? null,
})

export async function loadWorkingState(roomId: string): Promise<CloudWorking | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('gm_working_state')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle()
  return data ? toCloud(data as Row) : null
}

export function subscribeWorkingState(roomId: string, cb: (w: CloudWorking) => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`gws:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'gm_working_state', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const r = payload.new as Row & { image_path?: string }
        if (r?.image_path) cb(toCloud(r))
      },
    )
    .subscribe()
  return () => {
    void supabase!.removeChannel(channel)
  }
}
