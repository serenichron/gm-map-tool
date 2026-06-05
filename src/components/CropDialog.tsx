import { useEffect, useRef, useState } from 'react'

const V = 240 // crop viewport / circle diameter (px)
const OUT = 160 // output portrait size (px)

/**
 * Facebook-style portrait cropper: a fixed circle, with the image pannable and
 * zoomable underneath. Confirms to a small square WebP data URL (the token clips
 * it round). Pinch-to-zoom on touch; drag to pan; slider/wheel to zoom.
 */
export function CropDialog({
  file,
  onCancel,
  onDone,
}: {
  file: Blob
  onCancel: () => void
  onDone: (dataUrl: string) => void
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [minScale, setMinScale] = useState(1)
  const [scale, setScale] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 }) // image top-left in viewport px
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const pinch = useRef<{ dist: number; scale: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const i = new Image()
    i.onload = () => {
      const cover = Math.max(V / i.naturalWidth, V / i.naturalHeight)
      setImg(i)
      setMinScale(cover)
      setScale(cover)
      setOff({ x: (V - i.naturalWidth * cover) / 2, y: (V - i.naturalHeight * cover) / 2 })
    }
    i.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const clamp = (o: { x: number; y: number }, s: number, image = img) => {
    if (!image) return o
    const w = image.naturalWidth * s
    const h = image.naturalHeight * s
    return { x: Math.min(0, Math.max(V - w, o.x)), y: Math.min(0, Math.max(V - h, o.y)) }
  }

  // zoom keeping the viewport centre fixed
  const zoomTo = (ns: number) => {
    if (!img) return
    const s = Math.max(minScale, Math.min(minScale * 6, ns))
    const ratio = s / scale
    const nx = V / 2 - (V / 2 - off.x) * ratio
    const ny = V / 2 - (V / 2 - off.y) * ratio
    setScale(s)
    setOff(clamp({ x: nx, y: ny }, s))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale }
      drag.current = null
    } else {
      drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      zoomTo(pinch.current.scale * (dist / pinch.current.dist))
    } else if (drag.current) {
      setOff(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }, scale))
    }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }
  const onWheel = (e: React.WheelEvent) => {
    zoomTo(scale * (e.deltaY < 0 ? 1.08 : 0.92))
  }

  const done = () => {
    if (!img) return
    const cv = document.createElement('canvas')
    cv.width = OUT
    cv.height = OUT
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, -off.x / scale, -off.y / scale, V / scale, V / scale, 0, 0, OUT, OUT)
    onDone(cv.toDataURL('image/webp', 0.85))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="rounded-2xl border border-line bg-gradient-to-b from-panel-2 to-[#1a130b] p-4 shadow-2xl">
        <h3 className="mb-3 font-display text-[16px] font-semibold text-bone">Position the portrait</h3>
        <div
          className="relative touch-none select-none overflow-hidden rounded-lg bg-[#0f0b06]"
          style={{ width: V, height: V, cursor: 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {img && (
            <img
              src={img.src}
              draggable={false}
              alt=""
              className="absolute left-0 top-0 max-w-none select-none"
              style={{
                width: img.naturalWidth,
                height: img.naturalHeight,
                transform: `translate(${off.x}px, ${off.y}px) scale(${scale})`,
                transformOrigin: 'top left',
              }}
            />
          )}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: '0 0 0 9999px rgba(12,8,4,.66)', border: '2px solid rgba(236,224,203,.7)' }}
          />
        </div>
        <input
          type="range"
          min={minScale}
          max={minScale * 6}
          step={0.001}
          value={scale}
          onChange={(e) => zoomTo(+e.target.value)}
          className="mt-3 w-full cursor-pointer accent-ochre"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-[9px] border border-line bg-panel-2 px-3 py-2 font-ui text-[13px] text-bone-dim hover:text-bone"
          >
            Cancel
          </button>
          <button
            onClick={done}
            className="flex-1 rounded-[9px] border border-ochre bg-gradient-to-b from-[#3f2e1a] to-[#30230f] px-3 py-2 font-ui text-[13px] font-bold text-gold"
          >
            Use photo
          </button>
        </div>
      </div>
    </div>
  )
}
