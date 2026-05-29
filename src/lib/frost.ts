/**
 * The player's veil over hidden ground. Instead of a flat grey screen, hidden
 * areas show a blurred, dimmed, dust-tinted hint of the map beneath — enough to
 * feel something is there, not enough to read it. Revealing clears the veil;
 * semi-reveal's tears let crisp ground peek through. Built by drawing a blurred
 * copy of the map, tinting it with dust, then masking it to wherever fog remains.
 */
export function buildFrost(
  frost: HTMLCanvasElement,
  fog: HTMLCanvasElement,
  mapImg: CanvasImageSource,
  w: number,
  h: number,
) {
  const ctx = frost.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
  // a faint, heavily blurred hint of the ground; the animated haze (fogAnim)
  // layers the warm drifting dust on top of this. Draw the map overflowing the
  // edges by the blur radius so the blur doesn't fade the outer margin.
  const pad = 22
  ctx.filter = 'blur(18px) brightness(0.4) saturate(0.8)'
  ctx.drawImage(mapImg, -pad, -pad, w + 2 * pad, h + 2 * pad)
  ctx.filter = 'none'
  // keep the veil only where fog remains
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(fog, 0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
}
