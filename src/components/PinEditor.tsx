import { DOMAINS, type CrystalDomain, type Pin } from '../lib/pins.ts'

/**
 * Edit a pin's title, crystal domain, player note and GM-only note.
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
            Crystal domain
          </span>
          <div className="flex flex-wrap gap-2.5">
            {DOMAINS.map((d) => {
              const selected = pin.domain === d.key
              return (
                <button
                  key={d.key}
                  title={`${d.label} — ${d.meaning}`}
                  onClick={() => onPatch({ domain: d.key as CrystalDomain })}
                  className="h-7 w-7 rounded-[6px] border-2 transition"
                  style={{
                    transform: 'rotate(45deg)',
                    background: `linear-gradient(135deg, ${d.color}, #000)`,
                    borderColor: selected ? '#fff' : 'transparent',
                    boxShadow: selected ? `0 0 10px ${d.color}` : 'none',
                  }}
                />
              )
            })}
          </div>
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
