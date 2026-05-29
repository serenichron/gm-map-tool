/** A map image loaded into the workspace. `src` is an object URL (local-first);
 *  in milestone 6 this becomes a Supabase Storage path. width/height are the
 *  image's natural pixel dimensions — the coordinate space everything else
 *  (fog strokes, pins) is expressed in, so it stays resolution-independent. */
export type LoadedMap = {
  src: string
  width: number
  height: number
}
