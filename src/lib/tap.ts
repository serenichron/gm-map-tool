/**
 * Swallow the single "ghost" click that a touch screen synthesises ~after a tap.
 * Without this, tapping a pin opens the editor drawer right under the finger and
 * the follow-up click lands on whatever drawer control is now beneath it.
 *
 * Call it the moment a tap opens something under the finger. It eats the next
 * click (capture phase, before any handler), then cleans itself up shortly after.
 */
export function swallowNextClick() {
  const kill = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    cleanup()
  }
  const cleanup = () => {
    window.removeEventListener('click', kill, true)
    window.clearTimeout(timer)
  }
  const timer = window.setTimeout(cleanup, 400)
  window.addEventListener('click', kill, true)
}
