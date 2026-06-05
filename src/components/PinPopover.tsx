import type { PublicPin } from '../lib/transport.ts'
import { PinGlyph } from './PinGlyph.tsx'
import { PIN_COUNTER_SCALE } from './PinMarker.tsx'
import { DISPOSITIONS, NPC_STATUSES, dispositionColor } from '../lib/pins.ts'

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
          <div
            data-popover
            className="pointer-events-auto relative w-[220px] rounded-xl border border-ochre bg-gradient-to-b from-panel-2 to-[#1a130b] p-3.5 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute right-2 top-1.5 h-[24px] w-[24px] rounded-md text-[16px] text-bone-dim hover:bg-[#2a2015] hover:text-bone"
            >
              ✕
            </button>
            {pin.kind === 'npc' ? (
              <>
                <div className="mb-1.5 flex items-center gap-2.5 pr-6">
                  <span
                    className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2"
                    style={{ borderColor: dispositionColor(pin.disposition), background: '#16110b' }}
                  >
                    {pin.portrait ? (
                      <span
                        className="block h-full w-full"
                        style={{ backgroundImage: `url(${pin.portrait})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-bone-dim">
                        <PinGlyph name="npc" className="h-6 w-6" />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <h4 className="truncate font-display text-[16px] font-semibold leading-tight text-bone">
                      {pin.title || 'Unknown'}
                    </h4>
                    {pin.role && <p className="truncate text-[12px] text-bone-dim">{pin.role}</p>}
                  </div>
                </div>
                {(pin.disposition || pin.status) && (
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {pin.disposition && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                        style={{ background: `${dispositionColor(pin.disposition)}33`, color: dispositionColor(pin.disposition) }}
                      >
                        {DISPOSITIONS.find((d) => d.key === pin.disposition)?.label}
                      </span>
                    )}
                    {pin.status && (
                      <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-bone-dim">
                        {NPC_STATUSES.find((s) => s.key === pin.status)?.label}
                      </span>
                    )}
                  </div>
                )}
                {pin.playerNote && (
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-bone">{pin.playerNote}</p>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
