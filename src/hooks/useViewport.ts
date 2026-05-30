import { useCallback, useEffect, useRef } from 'react'

const MIN_SCALE = 0.05
const MAX_SCALE = 12
const FIT_PADDING = 0.94 // leave a little breathing room around the map

// Zoom is proportional to the actual scroll delta (exponential), so a mouse
// wheel notch and a trackpad's stream of small events both feel right. Pinch
// gestures arrive as ctrl+wheel and get a stronger factor.
const WHEEL_SENSITIVITY = 0.0015
const PINCH_SENSITIVITY = 0.01
const MAX_WHEEL_FACTOR = 1.4 // clamp momentum spikes so a flick can't lurch the zoom

const clampScale = (s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s))

export type View = { s: number; ox: number; oy: number }

export type ViewportOpts = {
  onScaleChange?: (scale: number) => void
  /** Return true if this pointerdown should pan; false routes it to onPaint*. Default: always pan. */
  shouldPan?: (e: PointerEvent) => boolean
  onPaintStart?: (pt: { x: number; y: number }, e: PointerEvent) => void
  onPaintMove?: (pt: { x: number; y: number }, e: PointerEvent) => void
  onPaintEnd?: (e: PointerEvent) => void
  /** when true, a press on a pin is left to the pin (drag); otherwise the press
   *  pans/paints as usual (the pin still gets a no-move tap for opening). */
  pinsDraggable?: () => boolean
}

/**
 * Imperative pan / zoom / fit for the map stage, with optional paint delegation.
 *
 * The transform is written straight to the stage element every frame — never
 * through React state — so dragging stays smooth and React stays out of the
 * pixels. React only hears the *scale* (for the zoom readout), and only when it
 * changes, so panning never triggers a re-render.
 *
 * A pointerdown either pans or is handed to the consumer's onPaint* callbacks,
 * decided by `shouldPan` (e.g. GM: middle/right button or pan tool → pan, left
 * button with a brush → paint). Callbacks are read from a ref, so passing fresh
 * closures each render is fine and never re-binds the native listeners.
 */
export function useViewport(width: number, height: number, opts: ViewportOpts = {}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const view = useRef<View>({ s: 1, ox: 0, oy: 0 })
  const lastReported = useRef(0)

  const optsRef = useRef(opts)
  optsRef.current = opts

  const apply = useCallback(() => {
    const st = stageRef.current
    if (!st) return
    const { s, ox, oy } = view.current
    st.style.transform = `translate(${ox}px, ${oy}px) scale(${s})`
    st.style.setProperty('--inv', String(1 / s))
    if (s !== lastReported.current) {
      lastReported.current = s
      optsRef.current.onScaleChange?.(s)
    }
  }, [])

  const fit = useCallback(() => {
    const vp = viewportRef.current
    if (!vp || !width || !height) return
    const vw = vp.clientWidth
    const vh = vp.clientHeight
    const s = clampScale(Math.min(vw / width, vh / height) * FIT_PADDING)
    view.current = { s, ox: (vw - width * s) / 2, oy: (vh - height * s) / 2 }
    apply()
  }, [width, height, apply])

  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const v = view.current
      const ns = clampScale(v.s * factor)
      if (ns === v.s) return
      v.ox = px - (px - v.ox) * (ns / v.s)
      v.oy = py - (py - v.oy) * (ns / v.s)
      v.s = ns
      apply()
    },
    [apply],
  )

  const zoomBy = useCallback(
    (factor: number) => {
      const vp = viewportRef.current
      if (!vp) return
      zoomAt(vp.clientWidth / 2, vp.clientHeight / 2, factor)
    },
    [zoomAt],
  )

  const screenToImage = useCallback((clientX: number, clientY: number) => {
    const vp = viewportRef.current
    if (!vp) return { x: 0, y: 0 }
    const rect = vp.getBoundingClientRect()
    const { s, ox, oy } = view.current
    return { x: (clientX - rect.left - ox) / s, y: (clientY - rect.top - oy) / s }
  }, [])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return

    // all active pointers (client coords), so we can detect a two-finger pinch
    const pointers = new Map<number, { x: number; y: number }>()
    let pan: { x: number; y: number; ox: number; oy: number } | null = null
    let painting = false
    // pinch anchors the image point under the gesture's midpoint, so zoom and
    // two-finger pan happen together and stay under the fingers
    let pinch: { imgX: number; imgY: number; startDist: number; startScale: number } | null = null

    const toImage = (e: PointerEvent) => {
      const rect = vp.getBoundingClientRect()
      const { s, ox, oy } = view.current
      return { x: (e.clientX - rect.left - ox) / s, y: (e.clientY - rect.top - oy) / s }
    }

    const twoFinger = () => {
      const rect = vp.getBoundingClientRect()
      const pts = [...pointers.values()]
      const ax = pts[0].x - rect.left
      const ay = pts[0].y - rect.top
      const bx = pts[1].x - rect.left
      const by = pts[1].y - rect.top
      return { midX: (ax + bx) / 2, midY: (ay + by) / 2, dist: Math.hypot(ax - bx, ay - by) || 1 }
    }

    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      // second finger → start pinch, abandoning any pan/stroke in progress
      if (pointers.size === 2) {
        if (painting) {
          painting = false
          optsRef.current.onPaintEnd?.(e)
        }
        pan = null
        const { midX, midY, dist } = twoFinger()
        const v = view.current
        pinch = { imgX: (midX - v.ox) / v.s, imgY: (midY - v.oy) / v.s, startDist: dist, startScale: v.s }
        return
      }
      if (pointers.size > 2) return

      const o = optsRef.current
      // only let a pin keep the press when pins are draggable; otherwise pan/paint
      if (o.pinsDraggable?.() && (e.target as Element | null)?.closest?.('[data-pin]')) return
      const wantsPan = o.shouldPan ? o.shouldPan(e) : true
      if (wantsPan) {
        const rect = vp.getBoundingClientRect()
        pan = { x: e.clientX - rect.left, y: e.clientY - rect.top, ox: view.current.ox, oy: view.current.oy }
        vp.setPointerCapture(e.pointerId)
        vp.style.cursor = 'grabbing'
      } else {
        painting = true
        vp.setPointerCapture(e.pointerId)
        o.onPaintStart?.(toImage(e), e)
      }
    }
    const move = (e: PointerEvent) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pinch && pointers.size >= 2) {
        const { midX, midY, dist } = twoFinger()
        const ns = clampScale(pinch.startScale * (dist / pinch.startDist))
        view.current.s = ns
        view.current.ox = midX - pinch.imgX * ns
        view.current.oy = midY - pinch.imgY * ns
        apply()
      } else if (pan) {
        const rect = vp.getBoundingClientRect()
        view.current.ox = pan.ox + (e.clientX - rect.left - pan.x)
        view.current.oy = pan.oy + (e.clientY - rect.top - pan.y)
        apply()
      } else if (painting) {
        optsRef.current.onPaintMove?.(toImage(e), e)
      }
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      // keep pinch off until all fingers lift, so a leftover finger doesn't pan
      if (pinch) {
        if (pointers.size < 2) pinch = null
        return
      }
      if (painting) {
        painting = false
        optsRef.current.onPaintEnd?.(e)
      }
      if (pan) {
        pan = null
        vp.style.cursor = ''
      }
    }
    const wheelZoom = (e: WheelEvent, sensitivity: number) => {
      let delta = e.deltaY
      if (e.deltaMode === 1) delta *= 16
      else if (e.deltaMode === 2) delta *= vp.clientHeight
      let factor = Math.exp(-delta * sensitivity)
      factor = Math.max(1 / MAX_WHEEL_FACTOR, Math.min(MAX_WHEEL_FACTOR, factor))
      const rect = vp.getBoundingClientRect()
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor)
    }

    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey) {
        // pinch gesture → zoom
        wheelZoom(e, PINCH_SENSITIVITY)
        return
      }
      // classic mouse wheel: line/page mode, or chunky vertical-only steps → zoom.
      // otherwise it's a trackpad two-finger swipe → pan.
      const isMouseWheel = e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50)
      if (isMouseWheel) {
        wheelZoom(e, WHEEL_SENSITIVITY)
      } else {
        view.current.ox -= e.deltaX
        view.current.oy -= e.deltaY
        apply()
      }
    }
    const noCtx = (e: Event) => e.preventDefault()

    vp.addEventListener('pointerdown', down)
    vp.addEventListener('pointermove', move)
    vp.addEventListener('pointerup', up)
    vp.addEventListener('pointercancel', up)
    vp.addEventListener('wheel', wheel, { passive: false })
    vp.addEventListener('contextmenu', noCtx)

    return () => {
      vp.removeEventListener('pointerdown', down)
      vp.removeEventListener('pointermove', move)
      vp.removeEventListener('pointerup', up)
      vp.removeEventListener('pointercancel', up)
      vp.removeEventListener('wheel', wheel)
      vp.removeEventListener('contextmenu', noCtx)
    }
    // width/height in deps so listeners (re)attach once the map mounts the
    // viewport element — refs alone don't re-trigger the effect.
  }, [apply, zoomAt, width, height])

  return { viewportRef, stageRef, view, fit, zoomBy, zoomAt, screenToImage }
}
