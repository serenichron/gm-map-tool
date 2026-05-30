/**
 * Pins mark places on the map. Each carries a title, a player note (shared on
 * publish) and a GM-only note (never sent to players). Colour comes from the
 * seven crystal domains, so a pin's colour means something in the world:
 * azure = memory, pale = revelation, crimson = body, and so on.
 *
 * Coordinates are image-space pixels, the same space fog strokes live in.
 */

export type CrystalDomain =
  | 'crimson'
  | 'amber'
  | 'verdant'
  | 'azure'
  | 'violet'
  | 'pale'
  | 'void'

export type Pin = {
  id: string
  x: number
  y: number
  color: string // hex; from a domain swatch or a custom colour
  icon: string // glyph key ('pin' = none)
  title: string
  playerNote: string
  gmNote: string
  domain?: CrystalDomain // legacy pins (pre-colour); used as a fallback
}

export const DEFAULT_PIN_COLOR = '#c8923d' // amber

/** Resolve a pin's colour, falling back to its legacy crystal domain. */
export function getPinColor(p: { color?: string; domain?: CrystalDomain }): string {
  return p.color || (p.domain ? domainColor(p.domain) : DEFAULT_PIN_COLOR)
}

export const DOMAINS: { key: CrystalDomain; label: string; color: string; meaning: string }[] = [
  { key: 'crimson', label: 'Crimson', color: '#b0463c', meaning: 'body, healing' },
  { key: 'amber', label: 'Amber', color: '#c8923d', meaning: 'energy, force' },
  { key: 'verdant', label: 'Verdant', color: '#6e7a4b', meaning: 'time, growth' },
  { key: 'azure', label: 'Azure', color: '#6d93a6', meaning: 'mind, memory' },
  { key: 'violet', label: 'Violet', color: '#8a6699', meaning: 'projection' },
  { key: 'pale', label: 'Pale', color: '#d9cdb5', meaning: 'light, revelation' },
  { key: 'void', label: 'Void', color: '#3b3340', meaning: 'gravity, absence' },
]

export const domainColor = (d: CrystalDomain): string =>
  DOMAINS.find((x) => x.key === d)?.color ?? '#c8923d'

export const newPinId = (): string =>
  'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
