import type { FogStyle } from '../lib/fogStyle.ts'

/**
 * GM-only tuning for the fog look: the veil colour (baked into the published
 * image), a colour + speed per drifting cloud layer, and a toggle to hide the
 * clouds so the veil underneath is visible. The caller owns the state.
 */
export function FogControls({
  style,
  onChange,
  hideClouds,
  onHideClouds,
}: {
  style: FogStyle
  onChange: (s: FogStyle) => void
  hideClouds: boolean
  onHideClouds: (b: boolean) => void
}) {
  const setColor = (i: number, v: string) => {
    const colors = [...style.clouds.colors] as [string, string, string]
    colors[i] = v
    onChange({ ...style, clouds: { ...style.clouds, colors } })
  }
  const setSpeed = (i: number, v: number) => {
    const speeds = [...style.clouds.speeds] as [number, number, number]
    speeds[i] = v
    onChange({ ...style, clouds: { ...style.clouds, speeds } })
  }
  return (
    <div className="flex flex-col gap-2.5">
      {/* veil colour (baked → reaches players on publish) */}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={style.veilColor}
          onChange={(e) => onChange({ ...style, veilColor: e.target.value })}
          className="h-7 w-7 shrink-0 cursor-pointer rounded border border-line bg-transparent p-0"
          title="Veil colour (baked into the published map)"
        />
        <span className="font-ui text-[11px] text-bone">Veil colour</span>
        <span className="ml-auto font-ui text-[10px] text-bone-dim">baked on publish</span>
      </div>

      <hr className="border-line" />

      {/* clouds */}
      <label className="flex items-center gap-2 font-ui text-[11px] text-bone">
        <input
          type="checkbox"
          checked={hideClouds}
          onChange={(e) => onHideClouds(e.target.checked)}
          className="h-3.5 w-3.5 accent-teal"
        />
        Hide clouds (preview only)
      </label>
      <div className={hideClouds ? 'pointer-events-none opacity-40' : ''}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <input
              type="color"
              value={style.clouds.colors[i]}
              onChange={(e) => setColor(i, e.target.value)}
              className="h-7 w-7 shrink-0 cursor-pointer rounded border border-line bg-transparent p-0"
              title={`Layer ${i + 1} colour`}
            />
            <span className="w-12 shrink-0 font-ui text-[11px] text-bone-dim">Layer {i + 1}</span>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={style.clouds.speeds[i]}
              onChange={(e) => setSpeed(i, +e.target.value)}
              className="h-1 flex-1 cursor-pointer accent-teal"
              title={`Layer ${i + 1} speed`}
            />
            <span className="w-8 shrink-0 text-right font-ui text-[11px] text-bone-dim">
              {style.clouds.speeds[i].toFixed(1)}×
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
