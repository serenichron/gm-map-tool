import type { PublicPin } from '../lib/transport.ts'
import { PinGlyph } from './PinGlyph.tsx'
import { PIN_COUNTER_SCALE } from './PinMarker.tsx'

/**
 * Read-only note shown when a player taps a pin. Player note only — the GM note
 * never reaches this screen. Anchored to the pin on the map (sits just up-right
 * of it) and counter-scaled like the pin, so it keeps a constant on-screen size
 * within the zoom band and scales with the map past the extremes.
 */
export function PinPopover({ pin, onClose }: { pin: PublicPin; onClose: () => void }) {
  const color = pin.color
  return (
    <div className="absolute z-20" style={{ left: pin.x, top: pin.y }}>
      {/* scales about the pin tip so the card grows out of the pin */}
      <div
        className="relative"
        style={{
          transform: `scale(${PIN_COUNTER_SCALE})`,
          transformOrigin: 'left bottom',
          willChange: 'transform',
        }}
      >
        {/* offsets are in counter-scaled space → constant on screen */}
        <div className="absolute" style={{ left: 12, bottom: 26 }}>
          <div className="pointer-events-auto relative w-[220px] rounded-xl border border-ochre bg-gradient-to-b from-panel-2 to-[#1a130b] p-3.5 shadow-2xl">
            <button
              onClick={onClose}
              className="absolute right-2 top-1.5 h-[24px] w-[24px] rounded-md text-[16px] text-bone-dim hover:bg-[#2a2015] hover:text-bone"
            >
              ✕
            </button>
            <h4 className="mb-1.5 flex items-center gap-2 pr-6 font-display text-[16px] font-semibold leading-tight text-bone">
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: color, boxShadow: `0 0 8px ${color}` }}
              >
                <PinGlyph name={pin.icon || 'pin'} className="h-3 w-3 text-[#16110b]" />
              </span>
              {pin.title || 'Unmarked'}
            </h4>
            {pin.playerNote ? (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-bone">{pin.playerNote}</p>
            ) : (
              <p className="text-[12px] italic text-bone-dim">No notes for this place.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
