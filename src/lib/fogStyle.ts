/**
 * Tunable look of the fog. GM-only — players inherit it (the veil through the
 * baked image, the clouds through the code defaults once we settle on values).
 *
 *  - veilColor : tint of the dimmed ground under the fog (baked into the image)
 *  - clouds    : a colour + speed per drifting cloud layer (3 layers)
 *
 * Stored per room (the GM's device).
 */
export type HazeStyle = {
  colors: [string, string, string]
  speeds: [number, number, number] // multipliers; 1 = the baseline drift speed
}

export type FogStyle = {
  veilColor: string
  clouds: HazeStyle
}

export const DEFAULT_HAZE: HazeStyle = {
  colors: ['#5b4a35', '#46443a', '#352c22'], // warm sand, grey dust, dark brown
  speeds: [1, 1, 1],
}

export const DEFAULT_VEIL_COLOR = '#262018' // the warm dust wash over hidden ground

export const DEFAULT_FOG_STYLE: FogStyle = { veilColor: DEFAULT_VEIL_COLOR, clouds: DEFAULT_HAZE }

/** Curated veil + 3-cloud palettes the GM can pick from (speeds left untouched). */
export type FogPreset = { name: string; veilColor: string; colors: [string, string, string] }
export const FOG_PRESETS: FogPreset[] = [
  { name: 'Ash Reach', veilColor: '#262018', colors: ['#5b4a35', '#46443a', '#352c22'] }, // warm desert dust (default)
  { name: 'The Pale', veilColor: '#2b2f31', colors: ['#565b60', '#3e4347', '#2a2f33'] }, // cold bone-grey
  { name: 'Saltworks', veilColor: '#213031', colors: ['#496461', '#334b49', '#223432'] }, // teal salt haze
  { name: 'The Scar', veilColor: '#2a1e22', colors: ['#6b4750', '#4a3340', '#2f2230'] }, // rust-violet
  { name: 'Quiet Forest', veilColor: '#232a1e', colors: ['#57694a', '#3e4a34', '#2a3224'] }, // mossy green
]

const keyFor = (roomId?: string) => `fog-style:${roomId ?? 'local'}`

export function loadFogStyle(roomId?: string): FogStyle {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(roomId)) || 'null')
    if (raw && raw.clouds && Array.isArray(raw.clouds.colors) && Array.isArray(raw.clouds.speeds)) {
      return {
        veilColor: typeof raw.veilColor === 'string' ? raw.veilColor : DEFAULT_VEIL_COLOR,
        clouds: {
          colors: [
            raw.clouds.colors[0] ?? DEFAULT_HAZE.colors[0],
            raw.clouds.colors[1] ?? DEFAULT_HAZE.colors[1],
            raw.clouds.colors[2] ?? DEFAULT_HAZE.colors[2],
          ],
          speeds: [
            Number(raw.clouds.speeds[0]) || DEFAULT_HAZE.speeds[0],
            Number(raw.clouds.speeds[1]) || DEFAULT_HAZE.speeds[1],
            Number(raw.clouds.speeds[2]) || DEFAULT_HAZE.speeds[2],
          ],
        },
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_FOG_STYLE
}

export function saveFogStyle(roomId: string | undefined, s: FogStyle) {
  localStorage.setItem(keyFor(roomId), JSON.stringify(s))
}
