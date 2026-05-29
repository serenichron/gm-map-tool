import { useRef } from 'react'
import { domainColor, type Pin } from '../lib/pins.ts'

const DRAG_THRESHOLD = 4 // px before a press becomes a drag rather than a tap

/**
 * A pin on the map. Counter-scaled (via the stage's --inv var) so it stays a
 * constant size on screen at any zoom. A generous transparent hit area makes it
 * comfortable to tap on touch screens. Tap opens the editor; drag moves it.
 *
 * `interactive` is false on the player screen (read-only — tap shows the note).
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
  const color = domainColor(pin.domain)
  const dragging = useRef(false)

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault()
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
          transform: 'translate(-50%, -50%) scale(var(--inv, 1))',
          transformOrigin: 'center',
          cursor: interactive ? 'grab' : 'pointer',
        }}
      >
        {/* transparent touch target around the gem */}
        <div className="relative flex h-10 w-10 items-center justify-center">
          <span
            className="absolute rounded-[4px]"
            style={{
              width: 18,
              height: 18,
              transform: 'rotate(45deg)',
              background: `linear-gradient(135deg, ${color}, #000)`,
              border: '1.5px solid rgba(255,255,255,.55)',
              boxShadow: `0 0 0 2px rgba(0,0,0,.45), 0 0 12px ${color}`,
            }}
          />
        </div>
        {pin.title && (
          <div className="absolute left-1/2 top-[34px] -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-[rgba(12,8,4,.82)] px-2 py-0.5 font-ui text-[11px] font-semibold text-bone shadow-[0_2px_6px_rgba(0,0,0,.5)]">
            {pin.title}
          </div>
        )}
      </div>
    </div>
  )
}
