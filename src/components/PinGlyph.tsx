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
  monster: (
    <>
      <path d="M6 3c2 5 3 12 3 18" />
      <path d="M11 3c2 5 3 12 3 18" />
      <path d="M16 3c2 5 3 12 3 18" />
    </>
  ),
  trap: (
    <>
      <path d="M3 16l3-6 3 6 3-6 3 6 3-6 3 6" />
      <path d="M3 16h18" />
    </>
  ),
  hazard: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
  treasure: (
    <>
      <path d="M3 8h18v12H3z" />
      <path d="M3 8l2-3h14l2 3" />
      <path d="M12 12v3" />
    </>
  ),
  crystal: (
    <>
      <path d="M12 2l7 7-7 13-7-13z" />
      <path d="M5 9h14" />
      <path d="M12 2v20" />
    </>
  ),
  secret: (
    <>
      <circle cx="12" cy="6.5" r="3.5" />
      <path d="M12 10v10" />
      <path d="M12 15h3" />
      <path d="M12 18h2.5" />
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
  ruin: (
    <>
      <path d="M3 21h18" />
      <path d="M6 21V9h3" />
      <path d="M12 21V5" />
      <path d="M17 21v-8h3" />
    </>
  ),
  camp: (
    <>
      <path d="M12 4L3 20h18z" />
      <path d="M9 20l3-5 3 5" />
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
