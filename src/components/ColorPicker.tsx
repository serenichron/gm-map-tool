import { useEffect, useRef, useState } from 'react'

/**
 * A self-contained colour picker — consistent on desktop and mobile (no native
 * <input type="color">, which renders differently per OS and often dim). Has a
 * saturation/value square, a hue bar, a transparency bar, hex + RGB + alpha
 * inputs, and up to 15 saved custom swatches (persisted in localStorage).
 *
 * `value`/`onChange` are colour strings: `#rrggbb`, or `#rrggbbaa` when the
 * colour has transparency.
 */

const SAVED_KEY = 'worldsmith-custom-colors'
const MAX_SAVED = 15

type HSVA = { h: number; s: number; v: number; a: number }
type RGB = { r: number; g: number; b: number }

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0')

function hsvToRgb(h: number, s: number, v: number): RGB {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g] = [c, x]
  else if (h < 120) [r, g] = [x, c]
  else if (h < 180) [g, b] = [c, x]
  else if (h < 240) [g, b] = [x, c]
  else if (h < 300) [r, b] = [x, c]
  else [r, b] = [c, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

function parseColor(str: string): (RGB & { a: number }) | null {
  let s = str.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('')
  const m = /^([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: m[2] !== undefined ? parseInt(m[2], 16) / 255 : 1 }
}

function toHex(r: number, g: number, b: number, a: number): string {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`
  return a >= 1 ? base : base + hex2(a * 255)
}

function loadSaved(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_SAVED) : []
  } catch {
    return []
  }
}

// warm checkerboard, shown behind transparent colours
const CHECKER: React.CSSProperties = {
  backgroundImage: 'conic-gradient(#5a4a35 0 25%, #2c2117 0 50%, #5a4a35 0 75%, #2c2117 0)',
  backgroundSize: '10px 10px',
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsva, setHsva] = useState<HSVA>(() => {
    const p = parseColor(value) || { r: 200, g: 146, b: 61, a: 1 }
    const { h, s, v } = rgbToHsv(p.r, p.g, p.b)
    return { h, s, v, a: p.a }
  })
  const hsvaRef = useRef(hsva)
  hsvaRef.current = hsva
  const lastEmit = useRef(value)
  const [saved, setSaved] = useState<string[]>(loadSaved)

  // re-sync when the colour is changed from outside (e.g. a domain swatch)
  useEffect(() => {
    if (value === lastEmit.current) return
    const p = parseColor(value)
    if (!p) return
    const { h, s, v } = rgbToHsv(p.r, p.g, p.b)
    setHsva({ h, s, v, a: p.a })
    lastEmit.current = value
  }, [value])

  const rgb = hsvToRgb(hsva.h, hsva.s, hsva.v)
  const ri = Math.round(rgb.r)
  const gi = Math.round(rgb.g)
  const bi = Math.round(rgb.b)
  const hex = toHex(ri, gi, bi, hsva.a)
  const hueRgb = hsvToRgb(hsva.h, 1, 1)
  const hueCss = `rgb(${Math.round(hueRgb.r)},${Math.round(hueRgb.g)},${Math.round(hueRgb.b)})`

  const [hexText, setHexText] = useState(hex)
  const hexFocused = useRef(false)
  useEffect(() => {
    if (!hexFocused.current) setHexText(hex)
  }, [hex])

  function commit(next: HSVA) {
    setHsva(next)
    const c = hsvToRgb(next.h, next.s, next.v)
    const out = toHex(Math.round(c.r), Math.round(c.g), Math.round(c.b), next.a)
    lastEmit.current = out
    onChange(out)
  }

  function startDrag(e: React.PointerEvent, el: HTMLElement, kind: 'sv' | 'hue' | 'alpha') {
    e.preventDefault()
    const apply = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect()
      const fx = clamp01((cx - r.left) / r.width)
      const fy = clamp01((cy - r.top) / r.height)
      const cur = hsvaRef.current
      if (kind === 'sv') commit({ ...cur, s: fx, v: 1 - fy })
      else if (kind === 'hue') commit({ ...cur, h: fx * 360 })
      else commit({ ...cur, a: fx })
    }
    apply(e.clientX, e.clientY)
    const mv = (ev: PointerEvent) => apply(ev.clientX, ev.clientY)
    const up = () => {
      window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
  }

  function setChannel(ch: keyof RGB, raw: number) {
    const v = Math.max(0, Math.min(255, Math.round(raw) || 0))
    const next = { r: ri, g: gi, b: bi, [ch]: v }
    const hsv = rgbToHsv(next.r, next.g, next.b)
    commit({ ...hsv, a: hsva.a })
  }

  function applyColorString(str: string) {
    const p = parseColor(str)
    if (!p) return
    const { h, s, v } = rgbToHsv(p.r, p.g, p.b)
    commit({ h, s, v, a: p.a })
  }

  function saveCurrent() {
    setSaved((prev) => {
      if (prev.includes(hex)) return prev
      const next = [hex, ...prev].slice(0, MAX_SAVED)
      localStorage.setItem(SAVED_KEY, JSON.stringify(next))
      return next
    })
  }
  function removeSaved(c: string) {
    setSaved((prev) => {
      const next = prev.filter((x) => x !== c)
      localStorage.setItem(SAVED_KEY, JSON.stringify(next))
      return next
    })
  }

  const numCls =
    'w-full rounded-[7px] border border-line bg-[#0f0b06] px-1.5 py-1 text-center font-ui text-[12px] text-bone outline-none focus:border-ochre'

  return (
    <div className="rounded-[10px] border border-line bg-[#1a130b] p-2.5">
      {/* saturation / value square */}
      <div
        onPointerDown={(e) => startDrag(e, e.currentTarget, 'sv')}
        className="relative h-28 w-full cursor-crosshair rounded-lg"
        style={{ background: hueCss, touchAction: 'none' }}
      >
        <div className="absolute inset-0 rounded-lg" style={{ background: 'linear-gradient(to right,#fff,rgba(255,255,255,0))' }} />
        <div className="absolute inset-0 rounded-lg" style={{ background: 'linear-gradient(to top,#000,rgba(0,0,0,0))' }} />
        <div
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_3px_rgba(0,0,0,.8)]"
          style={{ left: `${hsva.s * 100}%`, top: `${(1 - hsva.v) * 100}%` }}
        />
      </div>

      {/* hue */}
      <div
        onPointerDown={(e) => startDrag(e, e.currentTarget, 'hue')}
        className="relative mt-2.5 h-3 w-full cursor-pointer rounded-full"
        style={{
          touchAction: 'none',
          background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
        }}
      >
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_3px_rgba(0,0,0,.8)]"
          style={{ left: `${(hsva.h / 360) * 100}%` }}
        />
      </div>

      {/* transparency */}
      <div className="relative mt-2.5 h-3 w-full rounded-full" style={CHECKER}>
        <div
          onPointerDown={(e) => startDrag(e, e.currentTarget, 'alpha')}
          className="relative h-full w-full cursor-pointer rounded-full"
          style={{
            touchAction: 'none',
            background: `linear-gradient(to right, rgba(${ri},${gi},${bi},0), rgb(${ri},${gi},${bi}))`,
          }}
        >
          <div
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_3px_rgba(0,0,0,.8)]"
            style={{ left: `${hsva.a * 100}%` }}
          />
        </div>
      </div>

      {/* hex + rgb + alpha */}
      <div className="mt-2.5 flex items-center gap-1.5">
        <div className="flex-1">
          <span className="mb-0.5 block font-ui text-[9px] uppercase tracking-[0.08em] text-bone-dim">Hex</span>
          <input
            value={hexText}
            spellCheck={false}
            onFocus={() => (hexFocused.current = true)}
            onBlur={() => {
              hexFocused.current = false
              setHexText(hex)
            }}
            onChange={(e) => {
              setHexText(e.target.value)
              applyColorString(e.target.value)
            }}
            className="w-full rounded-[7px] border border-line bg-[#0f0b06] px-2 py-1 font-ui text-[12px] text-bone outline-none focus:border-ochre"
          />
        </div>
        {(['r', 'g', 'b'] as const).map((ch, i) => (
          <div key={ch} className="w-10">
            <span className="mb-0.5 block text-center font-ui text-[9px] uppercase tracking-[0.08em] text-bone-dim">
              {ch.toUpperCase()}
            </span>
            <input
              type="number"
              min={0}
              max={255}
              value={[ri, gi, bi][i]}
              onChange={(e) => setChannel(ch, +e.target.value)}
              className={numCls}
            />
          </div>
        ))}
        <div className="w-11">
          <span className="mb-0.5 block text-center font-ui text-[9px] uppercase tracking-[0.08em] text-bone-dim">A%</span>
          <input
            type="number"
            min={0}
            max={100}
            value={Math.round(hsva.a * 100)}
            onChange={(e) => commit({ ...hsva, a: clamp01((Math.round(+e.target.value) || 0) / 100) })}
            className={numCls}
          />
        </div>
      </div>

      {/* saved custom colours */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-ui text-[9px] uppercase tracking-[0.08em] text-bone-dim">
            Saved ({saved.length}/{MAX_SAVED})
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={saveCurrent}
            disabled={saved.length >= MAX_SAVED || saved.includes(hex)}
            title="Save current colour"
            className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-line text-[15px] leading-none text-ochre transition hover:bg-[#352818] disabled:opacity-30"
          >
            +
          </button>
          {saved.map((c) => (
            <div key={c} className="group relative">
              <button
                onClick={() => applyColorString(c)}
                title={c}
                className="h-6 w-6 rounded-[6px] border border-line"
                style={CHECKER}
              >
                <span className="block h-full w-full rounded-[5px]" style={{ background: c }} />
              </button>
              <button
                onClick={() => removeSaved(c)}
                title="Remove"
                className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full border border-line bg-ink text-[9px] leading-none text-bone-dim group-hover:flex hover:text-rust"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
