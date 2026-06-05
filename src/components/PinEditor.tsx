import { useRef, useState } from 'react'
import {
  DOMAINS,
  DISPOSITIONS,
  NPC_STATUSES,
  dispositionColor,
  getPinColor,
  isShared,
  DEFAULT_PIN_BORDER,
  DEFAULT_PIN_LABEL_BG,
  type Pin,
} from '../lib/pins.ts'
import { PIN_ICONS, PinGlyph } from './PinGlyph.tsx'
import { PinShape, glyphColor } from './PinMarker.tsx'
import { ColorPicker } from './ColorPicker.tsx'
import { CropDialog } from './CropDialog.tsx'

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
  const [extra, setExtra] = useState<'border' | 'label' | null>(null)
  const [titleFocused, setTitleFocused] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const portraitRef = useRef<HTMLInputElement>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const isNpc = pin.kind === 'npc'
  const current = getPinColor(pin)
  const labelBg = pin.labelBg || DEFAULT_PIN_LABEL_BG
  const labelFg = glyphColor(labelBg)

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
  function toggleShare(field: string) {
    onPatch({ share: { ...(pin.share ?? {}), [field]: !isShared(pin, field) } })
  }
  function onPortrait(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) setCropFile(f) // open the cropper; it returns the final portrait
  }
  // a compact "shown/hidden to players" pill for an NPC field
  const shareBtn = (field: string) => (
    <button
      type="button"
      onClick={() => toggleShare(field)}
      title={isShared(pin, field) ? 'Visible to players' : 'Hidden from players'}
      className={`ml-auto shrink-0 rounded-[6px] border px-1.5 py-0.5 font-ui text-[10px] ${
        isShared(pin, field) ? 'border-teal/60 bg-teal/10 text-teal' : 'border-line text-bone-dim'
      }`}
    >
      {isShared(pin, field) ? 'shown' : 'hidden'}
    </button>
  )

  return (
    <>
    {cropFile && (
      <CropDialog
        file={cropFile}
        onCancel={() => setCropFile(null)}
        onDone={(url) => {
          onPatch({ portrait: url })
          setCropFile(null)
        }}
      />
    )}
    <div className="fixed inset-x-0 bottom-0 z-30 flex max-h-[82vh] flex-col rounded-t-2xl border-t border-line bg-gradient-to-b from-panel-2 to-[#1c150d] shadow-[0_-12px_30px_rgba(0,0,0,.4)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[340px] sm:rounded-none sm:border-l sm:border-t-0 sm:shadow-[-12px_0_30px_rgba(0,0,0,.4)]">
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
            <PinShape
              color={current}
              icon={pin.icon || 'pin'}
              size={26}
              stroke={pin.borderColor || DEFAULT_PIN_BORDER}
              gmOnly={!!pin.gmOnly}
              npc={isNpc}
              portrait={pin.portrait}
              ring={dispositionColor(pin.disposition)}
            />
          </div>
          {pin.title && (
            // title label to the right of the pin head, as it appears on the map
            <div
              className="absolute flex items-center"
              style={{ left: PREVIEW_W / 2 + 15, top: PREVIEW_H / 2 - 21, transform: 'translateY(-50%)' }}
            >
              <span
                className="h-0 w-0 border-y-[5px] border-r-[6px] border-y-transparent"
                style={{ borderRightColor: labelBg }}
              />
              <div
                className="max-w-[78px] truncate rounded-[5px] border px-1.5 py-px font-ui text-[10px] font-semibold shadow-[0_1px_4px_rgba(0,0,0,.5)]"
                style={{
                  background: labelBg,
                  color: labelFg,
                  borderColor: labelFg === '#16110b' ? 'rgba(0,0,0,.28)' : 'rgba(74,58,39,.7)',
                }}
              >
                {pin.title}
              </div>
            </div>
          )}
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

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-[18px] py-4">
        {/* type: place marker vs NPC */}
        <div className="flex rounded-[9px] border border-line bg-[#0f0b06] p-0.5">
          {(['place', 'npc'] as const).map((k) => (
            <button
              key={k}
              onClick={() => onPatch({ kind: k })}
              className={`flex-1 rounded-[7px] py-1.5 font-ui text-[12px] font-semibold capitalize transition ${
                (pin.kind ?? 'place') === k ? 'bg-ochre/15 text-gold' : 'text-bone-dim hover:text-bone'
              }`}
            >
              {k === 'npc' ? 'NPC' : 'Place'}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1.5 block font-ui text-[11px] uppercase tracking-[0.08em] text-ochre">
            {isNpc ? 'Name' : 'Title'}
          </span>
          <div className="flex items-stretch gap-2">
            <input
              ref={titleRef}
              type="text"
              value={pin.title}
              onChange={(e) => onPatch({ title: e.target.value })}
              onFocus={() => setTitleFocused(true)}
              onBlur={() => setTitleFocused(false)}
              onKeyDown={(e) => e.key === 'Enter' && titleRef.current?.blur()}
              placeholder="e.g. The Glass Spines"
              autoComplete="off"
              enterKeyHint="done"
              className="w-full rounded-[9px] border border-line bg-[#0f0b06] px-3 py-2.5 font-body text-[14px] text-bone outline-none focus:border-ochre"
            />
            {titleFocused && (
              <button
                type="button"
                // keep focus on the input through the press, then blur on click
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => titleRef.current?.blur()}
                className="shrink-0 rounded-[9px] border border-line bg-panel-2 px-3 font-ui text-[12px] font-semibold text-bone-dim hover:text-bone"
              >
                Done
              </button>
            )}
          </div>
        </label>

        {isNpc && (
          <div className="flex flex-col gap-3">
            {/* portrait */}
            <div>
              <span className="mb-1.5 block font-ui text-[11px] uppercase tracking-[0.08em] text-ochre">
                Portrait
              </span>
              <div className="flex items-center gap-3">
                <div
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2"
                  style={{ borderColor: dispositionColor(pin.disposition), background: '#16110b' }}
                >
                  {pin.portrait ? (
                    <span
                      className="block h-full w-full"
                      style={{ backgroundImage: `url(${pin.portrait})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-bone-dim">
                      <PinGlyph name="npc" className="h-7 w-7" />
                    </span>
                  )}
                </div>
                <button
                  onClick={() => portraitRef.current?.click()}
                  className="rounded-[9px] border border-line bg-panel-2 px-3 py-2 font-ui text-[12px] text-bone hover:bg-[#352818]"
                >
                  {pin.portrait ? 'Replace' : 'Upload'}
                </button>
                {pin.portrait && (
                  <button
                    onClick={() => onPatch({ portrait: undefined })}
                    className="font-ui text-[11px] text-bone-dim hover:text-rust"
                  >
                    Remove
                  </button>
                )}
                <input ref={portraitRef} type="file" accept="image/*" className="hidden" onChange={onPortrait} />
              </div>
            </div>

            {/* role */}
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 font-ui text-[11px] uppercase tracking-[0.08em] text-ochre">
                Role {shareBtn('role')}
              </span>
              <input
                type="text"
                value={pin.role ?? ''}
                onChange={(e) => onPatch({ role: e.target.value })}
                placeholder="e.g. Saltworks foreman"
                autoComplete="off"
                className="w-full rounded-[9px] border border-line bg-[#0f0b06] px-3 py-2.5 font-body text-[14px] text-bone outline-none focus:border-ochre"
              />
            </label>

            {/* disposition */}
            <div>
              <span className="mb-1.5 flex items-center gap-2 font-ui text-[11px] uppercase tracking-[0.08em] text-ochre">
                Disposition {shareBtn('disposition')}
              </span>
              <div className="flex flex-wrap gap-2">
                {DISPOSITIONS.map((d) => {
                  const sel = (pin.disposition ?? 'unknown') === d.key
                  return (
                    <button
                      key={d.key}
                      onClick={() => onPatch({ disposition: d.key })}
                      className={`flex items-center gap-1.5 rounded-[8px] border px-2 py-1 font-ui text-[12px] ${
                        sel ? 'border-ochre text-bone' : 'border-line text-bone-dim hover:text-bone'
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* status */}
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 font-ui text-[11px] uppercase tracking-[0.08em] text-ochre">
                Status {shareBtn('status')}
              </span>
              <select
                value={pin.status ?? 'alive'}
                onChange={(e) => onPatch({ status: e.target.value as Pin['status'] })}
                className="w-full rounded-[9px] border border-line bg-[#0f0b06] px-3 py-2.5 font-ui text-[13px] text-bone outline-none focus:border-ochre"
              >
                {NPC_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block font-ui text-[11px] uppercase tracking-[0.08em] text-ochre">
            {isNpc ? 'Description (players)' : 'Player note'}
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

        <div className="rounded-[10px] border border-line bg-[#1a130b] p-3">
          <span className="mb-1.5 block font-ui text-[11px] uppercase tracking-[0.08em] text-ochre">
            Visibility
          </span>
          <label className="flex items-center gap-2.5 py-1 font-ui text-[13px] text-bone">
            <input
              type="checkbox"
              checked={!!pin.gmOnly}
              onChange={(e) => onPatch({ gmOnly: e.target.checked })}
              className="h-4 w-4 accent-rust"
            />
            Only I can see this pin
          </label>
          <span className="mb-1 block font-ui text-[10.5px] text-bone-dim">
            Never sent to players. Shown to you with a dashed outline and a ! mark.
          </span>

          <div>
            <label className="flex items-center gap-2.5 py-1 font-ui text-[13px] text-bone">
              <input
                type="checkbox"
                checked={!!pin.aboveFog}
                onChange={(e) => onPatch({ aboveFog: e.target.checked })}
                className="h-4 w-4 accent-ochre"
              />
              Show above the fog
            </label>
            <label
              className={`flex items-center gap-2.5 py-1 font-ui text-[13px] text-bone ${
                pin.aboveFog ? '' : 'pointer-events-none opacity-40'
              }`}
            >
              <input
                type="checkbox"
                checked={!!pin.labelAboveFog}
                disabled={!pin.aboveFog}
                onChange={(e) => onPatch({ labelAboveFog: e.target.checked })}
                className="h-4 w-4 accent-ochre"
              />
              Show its label over the fog
            </label>
            <span className="mt-1 block font-ui text-[10.5px] text-bone-dim">
              Off by default a pin hides under the fog and appears as the map is revealed.
            </span>
          </div>
        </div>

        {!isNpc && (
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
        )}

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
                    className="relative block h-7 w-7 rounded-full"
                    style={{
                      boxShadow: selected ? '0 0 0 2px #fff, 0 0 10px rgba(255,255,255,.25)' : 'inset 0 0 0 1px rgba(0,0,0,.35)',
                    }}
                  >
                    <span className="absolute inset-0 rounded-full" style={CHECKER} />
                    <span className="absolute inset-0 rounded-full" style={{ background: c }} />
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

        <div>
          <span className="mb-1.5 block font-ui text-[11px] uppercase tracking-[0.08em] text-ochre">
            Outline &amp; label
          </span>
          {(['border', 'label'] as const).map((kind) => {
            const isBorder = kind === 'border'
            const val = isBorder
              ? pin.borderColor || DEFAULT_PIN_BORDER
              : pin.labelBg || DEFAULT_PIN_LABEL_BG
            const custom = isBorder ? !!pin.borderColor : !!pin.labelBg
            const open = extra === kind
            return (
              <div key={kind} className="mb-2">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setExtra(open ? null : kind)}
                    title={val}
                    className={`block h-7 w-7 rounded-[7px] border-2 ${open ? 'border-ochre' : 'border-line'}`}
                    style={CHECKER}
                  >
                    <span className="block h-full w-full rounded-[5px]" style={{ background: val }} />
                  </button>
                  <span className="font-ui text-[13px] text-bone">
                    {isBorder ? 'Pin outline' : 'Label background'}
                  </span>
                  {custom && (
                    <button
                      onClick={() => onPatch(isBorder ? { borderColor: undefined } : { labelBg: undefined })}
                      className="ml-auto font-ui text-[11px] text-bone-dim hover:text-bone"
                    >
                      Reset
                    </button>
                  )}
                </div>
                {open && (
                  <div className="mt-2">
                    <ColorPicker
                      value={val}
                      onChange={(c) => onPatch(isBorder ? { borderColor: c } : { labelBg: c })}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
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
    </>
  )
}
