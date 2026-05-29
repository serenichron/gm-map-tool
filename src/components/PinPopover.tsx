import { domainColor } from '../lib/pins.ts'
import type { PublicPin } from '../lib/transport.ts'

/**
 * Read-only note shown when a player taps a pin. Player note only — the GM note
 * never reaches this screen. A bottom card, comfortable on phone and desktop.
 */
export function PinPopover({ pin, onClose }: { pin: PublicPin; onClose: () => void }) {
  const color = domainColor(pin.domain)
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3">
      <div className="relative w-full max-w-[420px] rounded-2xl border border-ochre bg-gradient-to-b from-panel-2 to-[#1a130b] p-5 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-2.5 top-2 h-[26px] w-[26px] rounded-md text-[18px] text-bone-dim hover:bg-[#2a2015] hover:text-bone"
        >
          ✕
        </button>
        <h4 className="mb-2 flex items-center gap-2.5 pr-6 font-display text-[19px] font-semibold text-bone">
          <span
            className="h-3 w-3 rounded-[3px]"
            style={{ transform: 'rotate(45deg)', background: color, boxShadow: `0 0 8px ${color}` }}
          />
          {pin.title || 'Unmarked'}
        </h4>
        {pin.playerNote ? (
          <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-bone">{pin.playerNote}</p>
        ) : (
          <p className="text-[13px] italic text-bone-dim">No notes for this place.</p>
        )}
      </div>
    </div>
  )
}
