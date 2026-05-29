/**
 * Rooms this device has joined as a player, so the launcher can offer them for
 * quick rejoin instead of retyping the code. Stored locally; most recent first.
 */
const KEY = 'stranded-recent-rooms'
const MAX = 8

export type RecentRoom = { code: string; name: string }

export function getRecentRooms(): RecentRoom[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function addRecentRoom(room: RecentRoom): void {
  const list = getRecentRooms().filter((r) => r.code !== room.code)
  list.unshift(room)
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
}

export function removeRecentRoom(code: string): void {
  localStorage.setItem(KEY, JSON.stringify(getRecentRooms().filter((r) => r.code !== code)))
}
