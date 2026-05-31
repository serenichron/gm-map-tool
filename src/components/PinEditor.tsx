import { DOMAINS, getPinColor, type Pin } from '../lib/pins.ts'
import { PIN_ICONS, PinGlyph } from './PinGlyph.tsx'
import { ColorPicker } from './ColorPicker.tsx'

/**
 * Edit a pin's title, marker (icon + colour), player note and GM-only note.
 * Responsive: a bottom sheet on phones/tablets, a right-hand panel on desktop.
 * The GM note is visually marked as never-shared.
 */
export function PinEditor({
  pin,
  onPatch,
  onDelete,
  onClose,
}: {
  pin: Pin
  onPatch: (patch: Partial<Pin>) => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex max-h-[82vh] flex-col rounded-t-2xl border-t border-line bg-gradient-to-b from-panel-2 to-[#1c150d] shadow-[0_-12px_30px_rgba(0,0,0,.4)] sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-auto sm:max-h-none sm:w-[340px] sm:rounded-none sm:border-l sm:border-t-0 sm:shadow-[-12px_0_30px_rgba(0,0,0,.4)]">
      <div className="flex items-center justify-between border-b border-line px-[18px] py-4">
        <h3 className="font-display text-[18px] font-semibold text-bone">Pin</h3>
        <button
          onClick={onClose}
          className="h-[30px] w-[30px] rounded-[7px] text-[20px] text-bone-dim hover:bg-[#2a2015] hover:text-bone"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-[18px] py-4">
        <label className="block">
          <span className="mb-1.5 block font-ui text-[11px] uppercase tracking-[0.08em] text-ochre">
            Title
          </span>
          <input
            type="text"
            value={pin.title}
            onChange={(e) => onPatch({ title: e.target.value })}
            placeholder="e.g. The Glass Spines"
            autoComplete="off"
            className="w-full rounded-[9px] border border-line bg-[#0f0b06] px-3 py-2.5 font-body text-[14px] text-bone outline-none focus:border-ochre"
          />
        </label>

        <div>
          <span className="mb-1.5 block font-ui text-[11px] uppercase tracking-[0.08em] text-ochre">
            Marker
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PIN_ICONS.map((g) => {
              const selected = (pin.icon || 'pin') === g.key
              return (
                <button
                  key={g.key}
                  title={g.label}
                  onClick={() => onPatch({ icon: g.key })}
                  className={`flex h-9 w-9 items-center justify-center rounded-[8px] border transition ${
                    selected
                      ? 'border-ochre bg-ochre/15 text-gold'
                      : 'border-line bg-panel-2 text-bone-dim hover:bg-[#352818] hover:text-bone'
                  }`}
                >
                  {g.key === 'pin' ? (
                    <span className="text-[11px]">—</span>
                  ) : (
                    <PinGlyph name={g.key} className="h-[18px] w-[18px]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block font-ui text-[11px] uppercase tracking-[0.08em] text-ochre">
            Colour
          </span>
          <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
            {DOMAINS.map((d) => {
              const selected = getPinColor(pin).toLowerCase() === d.color.toLowerCase()
              return (
                <button
                  key={d.key}
                  title={`${d.label} — ${d.meaning}`}
                  onClick={() => onPatch({ color: d.color })}
                  className="h-7 w-7 rounded-full border-2 transition"
                  style={{
                    background: d.color,
                    borderColor: selected ? '#fff' : 'transparent',
                    boxShadow: selected ? `0 0 10px ${d.color}` : 'none',
                  }}
                />
              )
            })}
          </div>
          <ColorPicker value={getPinColor(pin)} onChange={(c) => onPatch({ color: c })} />
        </div>

        <label className="block">
          <span className="mb-1.5 block font-ui text-[11px] uppercase tracking-[0.08em] text-ochre">
            Player note
          </span>
          <textarea
            value={pin.playerNote}
            onChange={(e) => onPatch({ playerNote: e.target.value })}
            rows={4}
            placeholder="What the table sees when they tap this pin."
            className="w-full resize-y rounded-[9px] border border-line bg-[#0f0b06] px-3 py-2.5 font-body text-[14px] leading-relaxed text-bone outline-none focus:border-ochre"
          />
          <span className="mt-1.5 block font-ui text-[10.5px] text-bone-dim">
            Shared with players on Publish.
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center gap-2 font-ui text-[11px] uppercase tracking-[0.08em] text-ochre">
            GM note
            <span className="inline-flex items-center gap-1 rounded-full border border-rust/40 bg-rust/10 px-2 py-0.5 text-[10px] normal-case tracking-normal text-rust">
              ● never shared
            </span>
          </span>
          <textarea
            value={pin.gmNote}
            onChange={(e) => onPatch({ gmNote: e.target.value })}
            rows={5}
            placeholder="Secrets, hooks, reminders. Stays on your screen only."
            className="w-full resize-y rounded-[9px] border border-line bg-[#0f0b06] px-3 py-2.5 font-body text-[14px] leading-relaxed text-bone outline-none focus:border-ochre"
          />
        </label>
      </div>

      <div className="flex gap-2.5 border-t border-line px-[18px] py-3.5">
        <button
          onClick={onDelete}
          className="rounded-[9px] border border-rust/50 bg-rust/10 px-3.5 py-2.5 font-ui text-[13px] font-semibold text-[#e6a48f] hover:bg-rust/20"
        >
          Delete
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-[9px] border border-ochre bg-gradient-to-b from-[#3f2e1a] to-[#30230f] px-3.5 py-2.5 font-ui text-[13px] font-bold text-gold"
        >
          Done
        </button>
      </div>
    </div>
  )
}
