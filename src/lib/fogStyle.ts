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
