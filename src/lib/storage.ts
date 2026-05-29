/**
 * Tiny IndexedDB key/value store for the local-first working state.
 * IndexedDB (not localStorage) because map images are far too big for the
 * ~5 MB localStorage cap. The image blob is stored once; the lighter fog ops
 * and pins are saved on every change.
 */
import type { FogOp } from './fog.ts'
import type { Pin } from './pins.ts'
import type { GridSettings } from './types.ts'

const DB_NAME = 'stranded-field-map'
const STORE = 'kv'

export type WorkingState = {
  width: number
  height: number
  fogOps: FogOp[]
  pins: Pin[]
  grid?: GridSettings | null
}

// Each room keeps its own draft (map image + fog + pins), keyed by room id.
export const workKey = (roomId: string) => `work:${roomId}`
export const imgKey = (roomId: string) => `img:${roomId}`

let dbp: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  })
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbDel(key: string): Promise<void> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
