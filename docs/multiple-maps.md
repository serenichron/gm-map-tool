# Multiple maps in a room — design notes

Status: **brainstorm captured, not yet built.** Backbone agreed; details to refine when we pick this up.

The goal: a room holds many maps (and later, other art). The GM can present them, the party can travel between them, and some can sit side by side. This is complex, so this doc records the design space, the decisions made, and a phased build order.

---

## Decisions so far

- **Backbone: a deck of scenes.** A room has a list of maps; one is the *active* (presented) map. Switching active is the spine of navigation and sync. Builds on the existing `rooms.active_map_id`.
- **Portals are required.** A pin (or region) can link to another map — tap it to travel there (world → region → building), with breadcrumbs + back. This leans into the game's theme of uncovering a connected world.
- **Same-canvas / spatial board is required.** Maps can be placed next to one another on one larger canvas and navigated spatially (pan/zoom between neighbours), with a minimap. Also enables seeing more than one map at once.
- **Per-map fog.** Each map keeps its own reveal state (fog strokes, pins, tokens). Switching maps does not disturb another map's fog.
- **Release gate is separate from the publish gate.** A map is *released* to players or not. Unreleased maps never appear in the player library. Released maps still obey the existing per-map publish/fog gate.
- **Players get navigation control too** (see "who drives navigation").

So the end state is a hybrid: **deck backbone + portals + spatial board**, layered in over several steps rather than built at once.

---

## The two axes that frame everything

### Axis 1 — how maps relate
1. **Deck of scenes** — flat list, one active. Simple, reliable. *Our backbone.*
2. **Linked / nested (portals)** — maps connect via link-pins; drill down/up with breadcrumbs. *Required.*
3. **Spatial board / infinite canvas** — maps placed adjacently on one canvas, navigated by panning; minimap to orient. *Required.*

### Axis 2 — who drives navigation during play
- **Present / Follow (GM-led):** GM sets the active map; players snap to it. Default for a guided scene.
- **Free-roam (player-led):** players browse the maps released to them while the GM runs the table (scouting, downtime, planning).
- **Leash / recall:** an "everyone come back to me" button that pulls free-roamers to the active map.

A per-room (or per-moment) toggle — *Players follow me* / *Players may roam* — covers most tables. Default freedom level is still **to confirm** (lean: follow by default, roam when the GM allows).

---

## What players can see (gate rules)

- Map **released** or not → controls whether it appears in the player library at all.
- Released + following → players see the GM's active map.
- Released + roaming → players may open any released map (each with its own published fog).
- Fog/pins/tokens are **per map**.
- GM-only pins and GM notes never reach players on any map (existing rule).

---

## Navigation surfaces

- **Sidebar / library:** lists all maps in the room, searchable (by name; later by tags, and possibly search pins across maps). Click to jump (GM) or open (player, if released). Thumbnails.
- **Breadcrumbs + back:** for portal drill-down (World › Ash Reach › Salt Town).
- **Minimap / board overview:** for the spatial canvas — see where maps sit relative to each other and jump.
- **Present controls (GM):** "Present this map" (push to followers), "Everyone follow me" (recall), per-map "Release to players".
- **Split / side-by-side:** show two maps at once (e.g. regional + tactical). Natural on the board; on the deck it needs an explicit "pin a second map" pane.

---

## Play scenarios to keep working

1. **Guided journey** — GM moves party desert → city; everyone follows. (Deck + Follow)
2. **Scout ahead** — one player roams to a released cave map while the rest stay. (Free-roam)
3. **Zoom in for a fight** — from the region map, open the tactical inn map. (Portal or switch active)
4. **Two at once** — world map + local map visible together. (Board / split view)
5. **Reconnect mid-session** — a returning player lands on the GM's active map. (Follow + active pointer)
6. **Recall** — GM pulls wandering players back. (Leash button)

---

## Phased build order

Each step is shippable on its own; ship in order.

1. **Deck + sidebar + Present/Follow.** Many maps per room; searchable sidebar with thumbnails; GM switches active; players follow; per-map fog; release toggle. Covers most tables.
2. **Free-roam toggle + recall.** Players browse released maps; "everyone follow me" button.
3. **Portals.** A pin can target another map → drill-down navigation + breadcrumbs/back. (Pin gains an optional `linkMapId`.)
4. **Spatial board + side-by-side.** Maps positioned on an infinite canvas; pan/zoom between them; minimap; show two at once. The biggest piece — build last, on top of the deck.

---

## Data model implications (sketch — refine later)

- **maps**: already exists (`id, room_id, name, image_path, width, height`). Add: `released boolean`, `created_at` ordering, optional `tags`, and for the board `board_x, board_y, board_scale` (position on the spatial canvas).
- **rooms**: `active_map_id` already present — this is the "presented" pointer followers track. Add a `player_roam boolean` (follow vs roam) and possibly a `view_mode` (deck | board).
- **published_state**: already keyed per map — good, fog/pins/tokens stay per map.
- **pins**: add optional `linkMapId` (portal target) and maybe `linkLabel`. A portal pin could reuse the existing pin object with a new icon/affordance.
- **Realtime/sync:** followers subscribe to `rooms.active_map_id` (and roam flag); switching active pushes a change; free-roamers ignore the active pointer until recalled. Board position changes are GM-authored, published like other state.

---

## Open questions for when we resume

- **Default player freedom:** locked-to-GM by default, or free-roam by default?
- **Side-by-side scope:** is two panes enough, or arbitrary many on the board?
- **"Other art":** fullscreen handouts/images vs. art placed *onto* a map (tokens/props) — decides whether the library is "maps" or "any visual." (Tokens already planned separately.)
- **Scale mismatch on the board:** how to place maps of very different real-world scales next to each other without it feeling wrong (per-map `board_scale`, or snap to a common grid?).
- **Portals vs. board overlap:** when both exist, is a portal just "fly to this map on the board," or a distinct hard cut? (Probably: portal = animated travel to that map, which on the board is a pan/zoom.)
