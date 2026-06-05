import type { HazeStyle } from '../lib/fogStyle.ts'

/**
 * Live tuning for the drifting fog: a colour + speed per cloud layer.
 * The caller owns the state (persist + pass to FogView).
 */
export function FogControls({ style, onChange }: { style: HazeStyle; onChange: (s: HazeStyle) => void }) {
  const setColor = (i: number, v: string) => {
    const colors = [...style.colors] as [string, string, string]
    colors[i] = v
    onChange({ ...style, colors })
  }
  const setSpeed = (i: number, v: number) => {
    const speeds = [...style.speeds] as [number, number, number]
    speeds[i] = v
    onChange({ ...style, speeds })
  }
  return (
    <div className="flex flex-col gap-2.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="color"
            value={style.colors[i]}
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
            value={style.speeds[i]}
            onChange={(e) => setSpeed(i, +e.target.value)}
            className="h-1 flex-1 cursor-pointer accent-teal"
            title={`Layer ${i + 1} speed`}
          />
          <span className="w-8 shrink-0 text-right font-ui text-[11px] text-bone-dim">
            {style.speeds[i].toFixed(1)}×
          </span>
        </div>
      ))}
    </div>
  )
}
