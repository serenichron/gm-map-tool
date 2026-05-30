import type { JSX } from 'react'

/** Small line-icon set for the toolbars. 24×24, stroke = currentColor. */
const PATHS: Record<string, JSX.Element> = {
  map: (
    <>
      <path d="M3 5h18v14H3z" />
      <path d="M4 16l5-5 4 4 3-3 4 4" />
    </>
  ),
  pan: (
    <path d="M9 11V5a2 2 0 0 1 4 0v6m0-3a2 2 0 0 1 4 0v3m0-1a2 2 0 0 1 4 0v5a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-3l-3-5a2 2 0 0 1 3.5-2L9 14" />
  ),
  reveal: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  semi: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
    </>
  ),
  hide: (
    <path d="M9.9 4.2A9.6 9.6 0 0 1 12 4c6.5 0 10 7 10 8a14 14 0 0 1-2.3 3M6.6 6.6C3.7 8.3 2 11.4 2 12c0 1 3.5 8 10 8 1.7 0 3.2-.4 4.5-1.1M3 3l18 18" />
  ),
  pin: (
    <>
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  tile: <path d="M12 2l7 4v8l-7 4-7-4V6z" />,
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </>
  ),
  redo: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0 0 10h3" />
    </>
  ),
  coverAll: <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" stroke="none" />,
  revealAll: <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 3" />,
  grid: (
    <>
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </>
  ),
  hexes: (
    <>
      <path d="M12 9 L10 12.46 L6 12.46 L4 9 L6 5.54 L10 5.54 Z" />
      <path d="M19 9 L17 12.46 L13 12.46 L11 9 L13 5.54 L17 5.54 Z" />
      <path d="M15.5 15 L13.5 18.46 L9.5 18.46 L7.5 15 L9.5 11.54 L13.5 11.54 Z" />
    </>
  ),
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  back: (
    <>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
}

export function Icon({
  name,
  className = 'h-[18px] w-[18px]',
}: {
  name: keyof typeof PATHS | string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name] ?? null}
    </svg>
  )
}
