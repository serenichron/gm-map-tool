import type { ReactNode, RefObject } from 'react'

/**
 * Presentational pan/zoom surface. The owning screen drives it via `useViewport`
 * and passes the refs in, so it can decide how pointer input is used (pan, paint,
 * pin). Overlay layers — the fog canvas, the pin layer — mount as `children`
 * inside the transformed stage and share the image-space coordinate system.
 */
export function Viewport({
  viewportRef,
  stageRef,
  src,
  width,
  height,
  cursorClass,
  children,
}: {
  viewportRef: RefObject<HTMLDivElement | null>
  stageRef: RefObject<HTMLDivElement | null>
  src: string
  width: number
  height: number
  cursorClass?: string
  children?: ReactNode
}) {
  return (
    <div className={`absolute inset-0 touch-none overflow-hidden ${cursorClass ?? ''}`} ref={viewportRef}>
      <div
        ref={stageRef}
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{ width, height }}
      >
        <img
          src={src}
          width={width}
          height={height}
          draggable={false}
          alt="map"
          className="pointer-events-none absolute left-0 top-0 block select-none"
        />
        {children}
      </div>
    </div>
  )
}
