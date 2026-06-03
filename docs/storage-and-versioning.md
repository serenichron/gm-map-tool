# Storage hygiene & published-state versioning

Status: **hygiene is live; versioning is a future design captured here.**

## Where things live today

- **Images** are in Supabase **Storage** (`maps` bucket), never in the database.
- The **database** (`published_state` row) holds only: the image *path*, the fog ops, pins, and grid (small JSON).
- **Publish overwrites one object per room** — `<roomId>/published.webp` (upsert) — so new versions do **not** accumulate. The `?v=` on the URL is a cache-buster, not a new file.
- The baked (veiled) image is generated **on the GM's browser** each publish; only the final WebP is uploaded.
- The **raw map** is stored separately for the GM's own cross-device sync (GM-only); it is never the player-facing file.

So going forward there is **no debris** — each publish replaces the current veiled image in place.

### Known debris (one-time)

Before baking existed, publish uploaded the raw map under a timestamped name (`<roomId>/<timestamp>.png`) each time. Those orphaned files still sit in Storage — unreferenced, not sent to anyone, not deleted. A one-time cleanup should delete everything in each room folder **except** the current `published.webp` and the GM's working image. Do this deliberately (destructive), not automatically.

## The key insight for versioning: the veil is re-derivable

The player-facing veiled image is a *pure function* of `raw map + fog ops` (mosaic + dust, see `bake.ts`). That means **we never need to store a veiled image per version**. To "track back," we only need to keep the **inputs**:

- the raw map (already stored once, GM-only), and
- a small **snapshot** per version: `{ version, fogOps, pins, grid, savedAt }` — all tiny JSON.

To restore an old version, load its snapshot as the working state and republish — the veiled image is re-baked from the raw map. So versioning costs almost nothing and creates no image debris.

## Future versioning design (track-back / revert)

**Goal:** let the GM see a history of published states and roll back to one.

**Model (proposed):**
- A `published_history` table (or a JSONB array on the room): rows of `{ room_id, map_id, version, fog, pins, grid, created_at }`. No image column.
- On publish: append a snapshot row, bump version. Current pointer = latest.
- **Retention:** keep the last **N** snapshots (e.g. 10–20) per map; prune older ones on publish. This is *intentional, bounded history* — not debris.
- Storage stays at **one veiled image per map** (the current one), overwritten each publish. (Optionally re-bake a thumbnail per snapshot for the history UI — small, and itself prunable.)

**UI (proposed):**
- A "History" panel in the GM view: a list of versions with timestamp (and optional thumbnail).
- Click a version → load it into the working state (preview), then "Restore" republishes it.
- Make clear restoring creates a *new* current version (non-destructive to the timeline).

**Notes:**
- Fog ops + pins are tiny, so snapshots are cheap; keeping 20 of them is negligible.
- Ties in with the multiple-maps plan: history is **per map**, like fog.
- If we later want true point-in-time veiled images (e.g. to diff exactly what players saw), we can store thumbnails per snapshot and the full veiled image only for the current version.

## Action items

- [x] Prune orphans on publish — after each publish the room's Storage folder is
  cleared of everything except the current veiled image + working image
  (`Backend.pruneStorage`). This also wipes the pre-bake orphans on the next
  publish, so the bucket self-heals.
- [ ] Future: implement `published_history` snapshots + retention + restore UI.
