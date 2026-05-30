import type { JSX } from 'react'

/** Glyphs that can sit inside a pin. `pin` = plain (no glyph) and is the default. */
export const PIN_ICONS: { key: string; label: string }[] = [
  { key: 'pin', label: 'Plain' },
  { key: 'monster', label: 'Monster' },
  { key: 'trap', label: 'Trap' },
  { key: 'hazard', label: 'Hazard' },
  { key: 'treasure', label: 'Treasure' },
  { key: 'crystal', label: 'Crystal' },
  { key: 'secret', label: 'Secret' },
  { key: 'rumor', label: 'Rumor' },
  { key: 'clue', label: 'Clue' },
  { key: 'objective', label: 'Objective' },
  { key: 'npc', label: 'NPC' },
  { key: 'settlement', label: 'Settlement' },
  { key: 'ruin', label: 'Ruin' },
  { key: 'camp', label: 'Camp' },
  { key: 'water', label: 'Water' },
  { key: 'star', label: 'Star' },
]

const GLYPHS: Record<string, JSX.Element | null> = {
  pin: null,
  // a ghost — round dome, scalloped hem, two eyes (round caps render the dots)
  monster: (
    <>
      <path d="M12 2a8 8 0 0 0-8 8v11l3-2 2 2 3-2 3 2 2-2 3 2V10a8 8 0 0 0-8-8z" />
      <path d="M9.5 10h.01" />
      <path d="M14.5 10h.01" />
    </>
  ),
  // bear-trap jaws — two rows of teeth facing across an open gap
  trap: (
    <>
      <path d="M4 7l2.7 4 2.7-4 2.6 4 2.7-4 2.6 4" />
      <path d="M4 17l2.7-4 2.7 4 2.6-4 2.7 4 2.6-4" />
    </>
  ),
  hazard: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
  // chest with a domed lid and a lock hasp
  treasure: (
    <>
      <path d="M4 9h16v11H4z" />
      <path d="M4 9V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2" />
      <path d="M4 13h16" />
      <path d="M11 13v2.5h2V13" />
    </>
  ),
  // faceted gem
  crystal: (
    <>
      <path d="M6 3h12l4 6-10 13L2 9z" />
      <path d="M11 3 8 9l4 13 4-13-3-6" />
      <path d="M2 9h20" />
    </>
  ),
  // key — round bow, two teeth
  secret: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M12 11v9" />
      <path d="M12 15h3.5" />
      <path d="M12 18h3" />
    </>
  ),
  rumor: <path d="M4 5h16v10H9l-4 4v-4H4z" />,
  clue: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="M14.5 14.5L20 20" />
    </>
  ),
  objective: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4h11l-2.5 4L17 12H6" />
    </>
  ),
  npc: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  settlement: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  // broken columns on a base — one jagged-topped, one shorter
  ruin: (
    <>
      <path d="M3 21h18" />
      <path d="M6 21V9h3v12" />
      <path d="M14 21v-8h3v8" />
      <path d="M6 9l1.5-3 1.5 3" />
    </>
  ),
  // tent — crossed poles, a door notch, the ground line
  camp: (
    <>
      <path d="M3.5 21 14 3" />
      <path d="M20.5 21 10 3" />
      <path d="M15.5 21 12 15l-3.5 6" />
      <path d="M2 21h20" />
    </>
  ),
  water: <path d="M12 3s7 7 7 12a7 7 0 0 1-14 0c0-5 7-12 7-12z" />,
  star: (
    <path
      d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 17l-5.3 2.6 1.1-6L3.4 9.4l6-.8z"
      fill="currentColor"
      stroke="none"
    />
  ),
}

export function PinGlyph({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  const g = GLYPHS[name]
  if (!g) return null
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {g}
    </svg>
  )
}
