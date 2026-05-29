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
  // a faint, heavily blurred hint of the ground. Draw the map at NATURAL size
  // (no scaling — scaling drifts position-dependently, more toward the corners),
  // then stretch the 1px edges outward so the blur doesn't fade the map border.
  const im = mapImg as HTMLImageElement
  const sW = im.naturalWidth || w
  const sH = im.naturalHeight || h
  const e = 48
  ctx.filter = 'blur(18px) brightness(0.4) saturate(0.8)'
  ctx.drawImage(im, 0, 0, w, h)
  ctx.drawImage(im, 0, 0, 1, sH, -e, 0, e, h) // clamp left
  ctx.drawImage(im, sW - 1, 0, 1, sH, w, 0, e, h) // clamp right
  ctx.drawImage(im, 0, 0, sW, 1, 0, -e, w, e) // clamp top
  ctx.drawImage(im, 0, sH - 1, sW, 1, 0, h, w, e) // clamp bottom
  ctx.filter = 'none'
  // keep the veil only where fog remains
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(fog, 0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
}
