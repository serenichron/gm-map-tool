import { useRef } from 'react'
import { getPinColor, DEFAULT_PIN_BORDER, DEFAULT_PIN_LABEL_BG, type LabelSide, type Pin } from '../lib/pins.ts'
import { PinGlyph } from './PinGlyph.tsx'
import { swallowNextClick } from '../lib/tap.ts'

// fade titles in only once zoomed in a bit (--inv = 1/scale): hidden when zoomed
// out (crowded), visible up close. Keeps the map readable.
const LABEL_FADE = 'clamp(0, (1.65 - var(--inv, 1)) * 1.8, 1)'

const DRAG_THRESHOLD = 4 // px before a press becomes a drag rather than a tap

// Counter the stage zoom so the pin holds a constant on-screen size — but only
// within a band. Clamped, so once you zoom far in it grows with the map, and far
// out it shrinks with the map (constant while the stage scale is ~0.4×–3×).
export const PIN_COUNTER_SCALE = 'clamp(0.4, var(--inv, 1), 3)'

/** Pick a legible glyph colour (dark on light pins, light on dark pins). */
export function glyphColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(hex.trim())
  if (!m) return '#ece0cb'
  const n = parseInt(m[1], 16)
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return lum > 150 ? '#16110b' : '#ece0cb'
}

/** The teardrop pin shape with its glyph — shared by the map marker and the
 *  editor's live preview so they always match. `size` is the width in px.
 *  `stroke` is the outline colour. */
export function PinShape({
  color,
  icon,
  size = 26,
  stroke = DEFAULT_PIN_BORDER,
}: {
  color: string
  icon: string
  size?: number
  stroke?: string
}) {
  const w = size
  const h = (size * 33) / 26
  const g = size * 0.5
  return (
    <div
      className="relative"
      style={{ width: w, height: h, filter: 'drop-shadow(0 1.5px 2px rgba(0,0,0,.55))' }}
    >
      <svg viewBox="0 0 28 36" style={{ width: w, height: h }} className="block">
        <path
          d="M14 35 C6 24 2 19 2 13 a12 12 0 0 1 24 0 C26 19 22 24 14 35 Z"
          fill={color}
          stroke={stroke}
          strokeWidth={1.6}
        />
        <circle cx="14" cy="13" r="8.5" fill="rgba(0,0,0,.16)" />
      </svg>
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ top: (h * 13) / 36, width: g, height: g, color: glyphColor(color) }}
      >
        <PinGlyph name={icon || 'pin'} className="h-full w-full" />
      </div>
    </div>
  )
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
  labelSide = 'right',
  screenToImage,
  onMove,
  onOpen,
}: {
  pin: Pin
  interactive: boolean
  labelSide?: LabelSide
  screenToImage: (clientX: number, clientY: number) => { x: number; y: number }
  onMove: (id: string, x: number, y: number) => void
  onOpen: (id: string) => void
}) {
  const color = getPinColor(pin)
  const border = pin.borderColor || DEFAULT_PIN_BORDER
  const labelBg = pin.labelBg || DEFAULT_PIN_LABEL_BG
  const labelFg = glyphColor(labelBg)
  const labelBorder = labelFg === '#16110b' ? 'rgba(0,0,0,.28)' : 'rgba(74,58,39,.7)'
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
      if (!dragging.current) {
        // eat the synthesised click so it can't tap a control on the drawer
        // that opens under the finger
        swallowNextClick()
        onOpen(pin.id)
      }
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
        <PinShape color={color} icon={pin.icon || 'pin'} size={26} stroke={border} />
        {pin.title &&
          (() => {
            const pill = (
              <div
                className="max-w-[116px] min-w-0 truncate rounded-[5px] border px-1.5 py-px font-ui text-[10px] font-semibold shadow-[0_1px_4px_rgba(0,0,0,.5)]"
                style={{ background: labelBg, color: labelFg, borderColor: labelBorder }}
              >
                {pin.title}
              </div>
            )
            return labelSide === 'left' ? (
              // label to the LEFT of the pin head, arrow pointing right at the pin
              <div
                className="pointer-events-none absolute right-[27px] top-[13px] flex -translate-y-1/2 items-center"
                style={{ opacity: LABEL_FADE, transition: 'opacity .2s' }}
              >
                {pill}
                <span className="h-0 w-0 border-y-[5px] border-l-[6px] border-y-transparent" style={{ borderLeftColor: labelBg }} />
              </div>
            ) : (
              // label to the RIGHT of the pin head, arrow pointing left at the pin
              <div
                className="pointer-events-none absolute left-[27px] top-[13px] flex -translate-y-1/2 items-center"
                style={{ opacity: LABEL_FADE, transition: 'opacity .2s' }}
              >
                <span className="h-0 w-0 border-y-[5px] border-r-[6px] border-y-transparent" style={{ borderRightColor: labelBg }} />
                {pill}
              </div>
            )
          })()}
      </div>
    </div>
  )
}
