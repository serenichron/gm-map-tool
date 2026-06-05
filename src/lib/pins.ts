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

export type PinKind = 'place' | 'npc'
export type Disposition = 'friendly' | 'neutral' | 'hostile' | 'unknown'
export type NpcStatus = 'alive' | 'wounded' | 'dead' | 'fled' | 'hidden' | 'unknown'

export type Pin = {
  id: string
  x: number
  y: number
  color: string // hex; from a domain swatch or a custom colour
  icon: string // glyph key ('pin' = none)
  title: string
  playerNote: string
  gmNote: string
  borderColor?: string // pin outline; defaults to a dark grey
  labelBg?: string // title pill background; defaults to a dark wash
  aboveFog?: boolean // show on top of the fog (default: hidden under it)
  labelAboveFog?: boolean // when above the fog, also show its title label
  gmOnly?: boolean // private to the GM — never sent to players
  domain?: CrystalDomain // legacy pins (pre-colour); used as a fallback
  // ── NPC (kind === 'npc') ──
  kind?: PinKind // default 'place'
  portrait?: string // small resized data URL, shown in the token + popover
  role?: string
  disposition?: Disposition
  status?: NpcStatus
  share?: Record<string, boolean> // per-field player visibility (NPC fields)
}

export const DISPOSITIONS: { key: Disposition; label: string; color: string }[] = [
  { key: 'friendly', label: 'Friendly', color: '#3e8e89' },
  { key: 'neutral', label: 'Neutral', color: '#c8bca6' },
  { key: 'hostile', label: 'Hostile', color: '#a8503a' },
  { key: 'unknown', label: 'Unknown', color: '#6a5a44' },
]
export const dispositionColor = (d?: Disposition): string =>
  DISPOSITIONS.find((x) => x.key === d)?.color ?? '#6a5a44'

export const NPC_STATUSES: { key: NpcStatus; label: string }[] = [
  { key: 'alive', label: 'Alive' },
  { key: 'wounded', label: 'Wounded' },
  { key: 'dead', label: 'Dead' },
  { key: 'fled', label: 'Fled' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'unknown', label: 'Unknown' },
]

// default per-field player visibility for NPC fields the GM can toggle
const SHARE_DEFAULTS: Record<string, boolean> = { role: true, disposition: false, status: false }
export const isShared = (pin: { share?: Record<string, boolean> }, field: string): boolean =>
  pin.share?.[field] ?? SHARE_DEFAULTS[field] ?? false

export const DEFAULT_PIN_COLOR = '#c8923d' // amber
export const DEFAULT_PIN_BORDER = '#403a32' // dark warm grey (not black)
export const DEFAULT_PIN_LABEL_BG = '#0c0804cc' // dark wash, ~0.8 alpha

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

export type LabelSide = 'left' | 'right'

/**
 * Decide which side each pin's title sits on. Default right; flip to the left
 * when another pin is close on the right (same rough height), so the label
 * doesn't cover that neighbour. Thresholds are in image pixels.
 */
export function computeLabelSides(pins: { id: string; x: number; y: number }[]): Record<string, LabelSide> {
  const NEAR_X = 170 // how far right a neighbour matters (≈ a label's reach)
  const NEAR_Y = 52 // vertical band where a neighbour would clash with the label
  const sides: Record<string, LabelSide> = {}
  for (const p of pins) {
    const blockedRight = pins.some(
      (o) => o.id !== p.id && o.x > p.x && o.x - p.x < NEAR_X && Math.abs(o.y - p.y) < NEAR_Y,
    )
    sides[p.id] = blockedRight ? 'left' : 'right'
  }
  return sides
}
