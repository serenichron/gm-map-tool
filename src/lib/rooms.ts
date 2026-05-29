import { supabase } from './supabase.ts'

export type Room = {
  id: string
  name: string
  join_code: string
  gm_id: string
}

// no ambiguous characters (0/O, 1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function genCode(len = 5): string {
  let s = ''
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return s
}

/** Create a room owned by the given anon uid, retrying on the rare code clash. */
export async function createRoom(gmId: string, name = 'Untitled room'): Promise<Room | null> {
  if (!supabase) return null
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('rooms')
      .insert({ join_code: genCode(), gm_id: gmId, name })
      .select()
      .single()
    if (!error && data) return data as Room
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.error('createRoom failed:', error.message)
      return null
    }
  }
  return null
}

/** All rooms owned by this GM, newest last. */
export async function listRooms(gmId: string): Promise<Room[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('rooms')
    .select('*')
    .eq('gm_id', gmId)
    .order('created_at', { ascending: true })
  return (data as Room[]) ?? []
}

export async function renameRoom(id: string, name: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('rooms').update({ name }).eq('id', id)
  if (error) console.error('renameRoom failed:', error.message)
}

export async function deleteRoom(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('rooms').delete().eq('id', id)
  if (error) console.error('deleteRoom failed:', error.message)
}

export async function getRoom(id: string): Promise<Room | null> {
  if (!supabase) return null
  const { data } = await supabase.from('rooms').select('*').eq('id', id).maybeSingle()
  return (data as Room) ?? null
}

export async function getRoomByCode(code: string): Promise<Room | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('rooms')
    .select('*')
    .eq('join_code', code.toUpperCase())
    .maybeSingle()
  return (data as Room) ?? null
}
