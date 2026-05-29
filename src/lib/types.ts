/** A map image loaded into the workspace. `src` is an object URL (local-first);
 *  in milestone 6 this becomes a Supabase Storage path. width/height are the
 *  image's natural pixel dimensions — the coordinate space everything else
 *  (fog strokes, pins) is expressed in, so it stays resolution-independent. */
export type LoadedMap = {
  src: string
  width: number
  height: number
}

/** Optional hex-tile overlay the GM can switch on. `size` is the hex radius in
 *  image-space pixels. Published so players see the same grid. */
export type GridSettings = {
  enabled: boolean
  size: number
}
