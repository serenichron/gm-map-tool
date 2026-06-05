/**
 * Tunable look of the drifting fog: a colour + speed per cloud layer (3 layers).
 * Persisted per device so the GM/player can adjust live; once we settle on
 * values we can bake them in as the defaults below.
 */
export type HazeStyle = {
  colors: [string, string, string]
  speeds: [number, number, number] // multipliers; 1 = the baseline drift speed
}

export const DEFAULT_HAZE: HazeStyle = {
  colors: ['#5b4a35', '#46443a', '#352c22'], // warm sand, grey dust, dark brown
  speeds: [1, 1, 1],
}

const KEY = 'fog-haze-style'

export function loadHazeStyle(): HazeStyle {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (raw && Array.isArray(raw.colors) && Array.isArray(raw.speeds)) {
      return {
        colors: [
          raw.colors[0] ?? DEFAULT_HAZE.colors[0],
          raw.colors[1] ?? DEFAULT_HAZE.colors[1],
          raw.colors[2] ?? DEFAULT_HAZE.colors[2],
        ],
        speeds: [
          Number(raw.speeds[0]) || DEFAULT_HAZE.speeds[0],
          Number(raw.speeds[1]) || DEFAULT_HAZE.speeds[1],
          Number(raw.speeds[2]) || DEFAULT_HAZE.speeds[2],
        ],
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_HAZE
}

export function saveHazeStyle(s: HazeStyle) {
  localStorage.setItem(KEY, JSON.stringify(s))
}
