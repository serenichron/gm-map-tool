import { useRef } from 'react'
import { getPinColor, type Pin } from '../lib/pins.ts'
import { PinGlyph } from './PinGlyph.tsx'

const DRAG_THRESHOLD = 4 // px before a press becomes a drag rather than a tap

// Counter the stage zoom so the pin holds a constant on-screen size — but only
// within a band. Clamped, so once you zoom far in it grows with the map, and far
// out it shrinks with the map (constant while the stage scale is ~0.4×–3×).
export const PIN_COUNTER_SCALE = 'clamp(0.4, var(--inv, 1), 3)'

/** Pick a legible glyph colour (dark on light pins, light on dark pins). */
function glyphColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#ece0cb'
  const n = parseInt(m[1], 16)
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return lum > 150 ? '#16110b' : '#ece0cb'
}

/**
 * A teardrop map pin (round top, pointed bottom) whose tip marks the spot.
 * Counter-scaled (via the stage's --inv var) to stay a constant on-screen size.
 * A generous transparent hit area makes it easy to tap on touch. Tap opens; drag
 * moves it (only when `interactive`).
 */
export function PinMarker({
  pin,
  interactive,
  screenToImage,
  onMove,
  onOpen,
}: {
  pin: Pin
  interactive: boolean
  screenToImage: (clientX: number, clientY: number) => { x: number; y: number }
  onMove: (id: string, x: number, y: number) => void
  onOpen: (id: string) => void
}) {
  const color = getPinColor(pin)
  const fg = glyphColor(color)
  const dragging = useRef(false)

  function onPointerDown(e: React.PointerEvent) {
    const startX = e.clientX
    const startY = e.clientY
    dragging.current = false

    const move = (ev: PointerEvent) => {
      if (!dragging.current && Math.hypot(ev.clientX - startX, ev.clientY - startY) > DRAG_THRESHOLD) {
        dragging.current = true
      }
      if (dragging.current && interactive) {
        const pt = screenToImage(ev.clientX, ev.clientY)
        onMove(pin.id, pt.x, pt.y)
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (!dragging.current) onOpen(pin.id)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="absolute" style={{ left: pin.x, top: pin.y }}>
      <div
        data-pin
        onPointerDown={onPointerDown}
        className="pointer-events-auto"
        style={{
          transform: `translate(-50%, -100%) scale(${PIN_COUNTER_SCALE})`,
          transformOrigin: 'bottom center',
          // own compositor layer → rasterised at its net (1×) scale, so the
          // vector stays crisp at any zoom instead of upscaling the stage texture
          willChange: 'transform',
          cursor: interactive ? 'grab' : 'pointer',
        }}
      >
        <div className="relative" style={{ width: 26, height: 33 }}>
          <svg viewBox="0 0 28 36" style={{ width: 26, height: 33 }} className="block">
            <path
              d="M14 35 C6 24 2 19 2 13 a12 12 0 0 1 24 0 C26 19 22 24 14 35 Z"
              fill={color}
              stroke="rgba(0,0,0,.55)"
              strokeWidth="1.5"
            />
            <circle cx="14" cy="13" r="8.5" fill="rgba(0,0,0,.16)" />
          </svg>
          <div
            className="absolute left-1/2 top-[12px] -translate-x-1/2 -translate-y-1/2"
            style={{ color: fg }}
          >
            <PinGlyph name={pin.icon || 'pin'} className="h-[13px] w-[13px]" />
          </div>
        </div>
        {pin.title && (
          <div className="absolute left-1/2 top-[35px] -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-[rgba(12,8,4,.82)] px-2 py-0.5 font-ui text-[11px] font-semibold text-bone shadow-[0_2px_6px_rgba(0,0,0,.5)]">
            {pin.title}
          </div>
        )}
      </div>
    </div>
  )
}
