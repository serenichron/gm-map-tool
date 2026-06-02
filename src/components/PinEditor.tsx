import { useState } from 'react'
import { DOMAINS, getPinColor, type Pin } from '../lib/pins.ts'
import { PIN_ICONS, PinGlyph } from './PinGlyph.tsx'
import { PinShape } from './PinMarker.tsx'
import { ColorPicker } from './ColorPicker.tsx'
import { useMapLuminance } from '../lib/luminance.ts'

const SAVED_KEY = 'worldsmith-custom-colors'
const MAX_SAVED = 15
const PREVIEW_W = 128
const PREVIEW_H = 96
// warm checkerboard behind transparent swatches
const CHECKER: React.CSSProperties = {
  backgroundImage: 'conic-gradient(#5a4a35 0 25%, #2c2117 0 50%, #5a4a35 0 75%, #2c2117 0)',
  backgroundSize: '10px 10px',
}

function loadSaved(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_SAVED) : []
  } catch {
    return []
  }
}

/**
 * Edit a pin's title, marker (icon + colour), player note and GM-only note.
 * Responsive: a bottom sheet on phones/tablets, a right-hand panel on desktop.
 * The GM note is visually marked as never-shared.
 */
export function PinEditor({
  pin,
  mapSrc,
  mapWidth,
  mapHeight,
  onPatch,
  onDelete,
  onClose,
}: {
  pin: Pin
  mapSrc?: string
  mapWidth?: number
  mapHeight?: number
  onPatch: (patch: Partial<Pin>) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [saved, setSaved] = useState<string[]>(loadSaved)
  const [pickerOpen, setPickerOpen] = useState(false)
  const current = getPinColor(pin)
  const lum = useMapLuminance(mapSrc)
  const darkUnder = lum ? lum(pin.x, pin.y) < 115 : false

  function persist(next: string[]) {
    setSaved(next)
    localStorage.setItem(SAVED_KEY, JSON.stringify(next))
  }
  function saveCurrent() {
    if (!saved.includes(current) && saved.length < MAX_SAVED) persist([...saved, current])
    setPickerOpen(false)
  }
  function removeColor(c: string) {
    persist(saved.filter((x) => x !== c))
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex max-h-[82vh] flex-col rounded-t-2xl border-t border-line bg-gradient-to-b from-panel-2 to-[#1c150d] shadow-[0_-12px_30px_rgba(0,0,0,.4)] sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-auto sm:max-h-none sm:w-[340px] sm:rounded-none sm:border-l sm:border-t-0 sm:shadow-[-12px_0_30px_rgba(0,0,0,.4)]">
      <div className="flex items-center gap-3 border-b border-line px-[18px] py-4">
        {/* live preview over a crop of the real map at the pin's spot, so the
            user sees how it looks in context while the drawer covers the map */}
        <div
          className="relative shrink-0 overflow-hidden rounded-[8px] border border-line bg-[#16110b]"
          style={{ width: PREVIEW_W, height: PREVIEW_H }}
        >
          {mapSrc && mapWidth && mapHeight && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${mapSrc})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${mapWidth}px ${mapHeight}px`,
                backgroundPosition: `${PREVIEW_W / 2 - pin.x}px ${PREVIEW_H / 2 - pin.y}px`,
              }}
            />
          )}
          <div
            className="absolute"
            style={{ left: PREVIEW_W / 2, top: PREVIEW_H / 2, transform: 'translate(-50%, -100%)' }}
          >
            <PinShape color={current} icon={pin.icon || 'pin'} size={26} darkUnder={darkUnder} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[18px] font-semibold text-bone">
            {pin.title || 'Pin'}
          </h3>
          <span className="font-ui text-[10.5px] text-bone-dim">Preview on the map</span>
        </div>
        <button
          onClick={onClose}
          className="h-[30px] w-[30px] shrink-0 rounded-[7px] text-[20px] text-bone-dim hover:bg-[#2a2015] hover:text-bone"
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
          {/* presets */}
          <div className="flex flex-wrap items-center gap-2.5">
            {DOMAINS.map((d) => {
              const selected = current.toLowerCase() === d.color.toLowerCase()
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

          <hr className="my-3 border-t border-line" />

          {/* saved custom colours + add */}
          <div className="flex flex-wrap items-center gap-2.5">
            {saved.map((c) => {
              const selected = current.toLowerCase() === c.toLowerCase()
              return (
                <div key={c} className="group relative">
                  <button
                    title={c}
                    onClick={() => onPatch({ color: c })}
                    className="block h-7 w-7 rounded-full border-2"
                    style={{ ...CHECKER, borderColor: selected ? '#fff' : 'transparent' }}
                  >
                    <span className="block h-full w-full rounded-full" style={{ background: c }} />
                  </button>
                  <button
                    onClick={() => removeColor(c)}
                    title="Remove"
                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full border border-line bg-ink text-[10px] leading-none text-bone-dim group-hover:flex hover:text-rust"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
            <button
              onClick={() => setPickerOpen((o) => !o)}
              title="Add a custom colour"
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-[18px] leading-none transition ${
                pickerOpen ? 'border-ochre bg-ochre/15 text-gold' : 'border-line text-ochre hover:bg-[#352818]'
              }`}
            >
              +
            </button>
          </div>

          {pickerOpen && (
            <div className="mt-3">
              <ColorPicker value={current} onChange={(c) => onPatch({ color: c })} />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={saveCurrent}
                  disabled={saved.includes(current) || saved.length >= MAX_SAVED}
                  className="flex-1 rounded-[9px] border border-ochre bg-gradient-to-b from-[#3f2e1a] to-[#30230f] px-3 py-2 font-ui text-[12px] font-bold text-gold disabled:opacity-40"
                >
                  {saved.includes(current) ? 'Saved' : `Save colour (${saved.length}/${MAX_SAVED})`}
                </button>
                <button
                  onClick={() => setPickerOpen(false)}
                  className="rounded-[9px] border border-line bg-panel-2 px-3 py-2 font-ui text-[12px] text-bone-dim hover:text-bone"
                >
                  Close
                </button>
              </div>
            </div>
          )}
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
