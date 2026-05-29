# The Stranded, field map

Project context for Claude Code. Read this before making structural or design choices.

This is a fog-of-war map tool for a tabletop role-playing game called The Stranded. A game master (GM) runs a map and reveals it to players in real time. Players are online, on their own devices, in different places. The tool replaces a single-file HTML prototype that faked multiplayer through one browser talking to itself. This version uses a real database so players elsewhere see the map update the moment the GM pushes it.

Keep this file accurate as the project grows. If a decision here turns out wrong, change it here, do not work around it silently.

---

## What we are building

A web app with two roles, chosen at sign-in or by link:

- **GM screen.** Loads a map image, covers it in fog, reveals parts with brushes, drops pins with notes, then publishes the current state to players.
- **Player screen.** Joins a room by code or link, sees only what the GM has published, pans and zooms, clicks pins to read notes.

Players never see a change until the GM publishes it. That gate is the heart of the tool. Editing happens privately on the GM's screen; publishing is a deliberate act.

---

## Stack and the decisions that matter

Recommended stack, assume it unless there is a strong reason to switch:

- **React + Vite + TypeScript.** Most documented path, fewest footguns for generated code. Svelte would be lighter for an app this small, but React has more Supabase realtime examples to lean on. Pick one and commit; do not mix.
- **Tailwind CSS** for styling, with the design tokens in the design section below baked into the Tailwind theme.
- **Supabase** for the database (Postgres), realtime, file storage, and auth. Free tier is enough for a hobby game. The constraint that bites is image size, see below.
- **Components**, kept small. Likely: `MapCanvas`, `Viewport` (pan/zoom), `Toolbar`, `BrushControls`, `PinList`, `PinEditor`, `PinPopover`, `RoomBar`, `JoinScreen`.

Three decisions to get right early, because they are expensive to undo:

1. **Do not store fog as a PNG in the database.** The prototype dumps the whole fog canvas as a base64 data-URL. That works in one browser but is far too heavy to send over a network on every update. Store fog as a list of brush strokes instead (see data model). Strokes are tiny, they replay identically on every screen, and they give you undo almost for free.
2. **Store the map image once in Supabase Storage, not in a database row.** The image never changes during play. Upload it once, keep only its path. Send the path, not the pixels.
3. **Keep the canvas drawing imperative.** Fog and reveal effects are raw canvas work. Hold the canvas in a ref and draw into it directly. Do not try to express per-pixel drawing through React state or components. The framework manages the toolbar, the pins, the room, the layout. It does not manage the pixels.

---

## The world, so your choices fit it

You do not need the full lore to build the tool, but design and naming should fit the setting. The full design documents should live in `/docs` in this repo; read them when a naming or content choice comes up. Short version follows.

**The Stranded** is a sci-fantasy survival game on a desert planet. The planet orbits a dim red star, so the light is always low and warm, like late afternoon everywhere, all the time. There is no bright midday. The palette is dusty: ochre, rust-red, faded teal, bone-white, warm shadow. Think weathered ruins, salt flats, improvised tech, small holdouts of survivors rather than cities.

The mood is quiet and worn, melancholy but with hope in it. Studio Ghibli's softer moments, Moebius, the calmer parts of Fallout, ruined Mediterranean towns under a low sun. Nothing is shiny. Nothing is clean. Everything has been used, repaired, and used again.

The world forgets itself. A broken memory-crystal erased everyone's minds long ago, and aftershocks keep wiping memory every few centuries. So the past is genuinely lost, and uncovering it is the point of play. That theme matters for the tool: revealing a map is uncovering something hidden, not just turning on a light. The fog is not a technical overlay. It is dust, distance, and forgetting.

**Crystals** are the core object. Seven colour domains, each tied to a meaning:

- Crimson, body and healing
- Amber, energy and force
- Verdant, time and growth
- Azure, mind and memory
- Violet, projection and influence
- Pale, light and revelation
- Void, gravity and absence (legendary, rare)

Use these seven as the pin colour palette. A pin coloured azure means something tied to memory; a pale pin means revelation. It is a small touch that makes the tool feel part of the game.

**Trade-tongue** is the common language in the game, a worn mix of older roots and plain everyday words. The full reference is in `/docs/trade_tongue.md`. Use it for flavour in labels where it fits, but never at the cost of clarity. A button that says "Reveal" should say "Reveal". A loading message or an empty state can carry a trade-tongue phrase. Examples already in the prototype: a player waiting screen reads "The dust has not cleared". That is the right level: atmospheric, but the meaning is obvious.

Regions the GM might map (names for example content and test data): the Ash Reach (deserts), the Glass Spines (crystal mountains), the Quiet Forest (petrified woodland), the Saltworks (flooded salt flats), the Pale (cool north), the Scar (an unstable wound across the land).

---

## The two roles

**GM** owns a room. Authenticated. Can create rooms, upload maps, edit fog and pins, and publish. Sees the map faintly through their own fog so they can work. Holds private notes players never receive.

**Player** joins a room with a code or link. No account needed beyond an anonymous session. Read-only on the published state. Cannot edit fog or pins, cannot see GM notes, cannot see anything unpublished.

---

## GM features

Carry over from the prototype:

- Load a map image by drag-drop or file picker. Upload to Storage.
- Fog covers the whole map on load.
- **Reveal brush.** Clears fog with a soft, diffused edge.
- **Hide brush.** Re-covers an area with fog.
- **Semi-reveal brush.** Tears the fog into ragged strips, a partial glimpse rather than a clean reveal. Strips are torn streaks, not dots. Repeated passes over the same area open more of it. The strip pattern must reproduce identically on every player screen, so send a seed, not client-side randomness.
- Adjustable brush size.
- Cover all, reveal all.
- Pan, zoom, fit to screen. Scroll to zoom, drag to pan.
- **Pins.** Place, drag to move, delete. Each pin has a title, a player note (shared on publish), a GM-only note (never sent), and a colour from the seven crystal domains.
- **Publish.** Pushes the current map, fog, and pins to players. A clear "you have unpublished changes" state on the button.

Worth adding, roughly in order of value:

- **Rooms with a share code or link.** The GM creates a room, gets a code, hands it to players.
- **Undo and redo** on fog strokes. Cheap once fog is a stroke list.
- **Multiple maps per room**, with a switcher. A campaign has more than one place.
- **Live tokens.** Small markers (party, enemies, points of interest) the GM can drag while players watch in real time. Use ephemeral realtime for the drag, persist position on publish (see sync model).
- **Staged versus live preview.** Let the GM see what is currently published versus what they have edited but not yet pushed. This makes the publish gate legible.
- **Reveal around a pin.** A quick action to clear fog in a radius around a chosen pin.
- **A measure or ruler tool**, light, since the game is narrative rather than grid-based. Do not build a tactical grid by default; the game explicitly avoids grid combat. A toggleable faint grid is acceptable as an option, off by default.
- **Connected players list.** Who is in the room right now.
- **Room notes or journal**, GM-only, for session prep.

Do not build an initiative tracker, character sheets, or dice. Out of scope. This is a map tool.

---

## Player features

- **Join by code or link.** Anonymous session, no sign-up friction. Players are often on a phone or tablet at a table.
- See only the published map. Fog shows as warm dust, not a grey overlay. Hidden areas can show a very faint, heavily blurred hint of the ground underneath, enough to feel that something is there, not enough to read it.
- Semi-revealed areas show the torn strips, matching the GM's screen exactly.
- Pan, zoom, fit.
- **Click a pin** to read its player note. Never the GM note.
- **Live indicator** showing the screen is connected and in sync.
- See live token positions when the GM moves them.
- Graceful reconnect. If the connection drops, rejoin and pull the current state.
- Responsive layout that works on a tablet and a phone, not just desktop.

Optional, behind a GM toggle:

- **Player pings.** A player taps a spot to drop a brief "look here" marker the GM and other players see. Ephemeral.
- **Player-controlled tokens.** Each player moves their own character marker. Off by default.

---

## Data model (starting point)

Adjust as needed, but keep the shape. Use Row Level Security so players can only read published state and cannot write.

- **rooms**: `id`, `name`, `gm_user_id`, `join_code` (short, shareable), `active_map_id`, `created_at`.
- **maps**: `id`, `room_id`, `name`, `image_path` (Storage), `width`, `height`, `created_at`.
- **published_state**: `room_id` (or `map_id`), `version` (integer, bumped on each publish), `fog` (JSONB array of strokes), `pins` (JSONB), `tokens` (JSONB), `updated_at`. One row per active map, overwritten on publish. Players read this.
- **gm_working_state** (optional but recommended): the GM's unpublished draft, autosaved, same shape as published_state, so the GM never loses work on a refresh. Never readable by players.

A fog stroke is small: `{ tool: 'reveal' | 'hide' | 'semi', x, y, radius, seed? }`. For semi strokes, `seed` drives the torn-strip pattern so every client draws the same tears. The player replays the stroke list onto a fresh fog canvas. Order matters: replay in sequence.

Map images go in a Storage bucket, one per map, referenced by `image_path`. Do not inline image data anywhere in the database.

---

## Realtime and the publish gate

Two kinds of update, handled differently:

1. **Published state** (fog, pins, the map itself). Persisted. Players subscribe to changes on the `published_state` row for their room. On publish, the GM writes the row and bumps `version`; Supabase pushes the change; players replay it. This is the deliberate, gated update.

2. **Live ephemeral movement** (token drag, player pings, GM cursor if shown). Do not write these to the database on every frame. Use a Supabase realtime broadcast channel for the room. Send positions over broadcast while dragging, persist the final position into `published_state.tokens` only on release or next publish. This keeps the database quiet and the movement smooth.

The GM's brush work while editing is local only. Nothing reaches players until publish. That separation is the whole point, build it in from the start rather than bolting it on.

Auth: GM signs in (email magic link is enough). Players join anonymously with the room code. RLS policies: a room's GM can read and write everything for that room; anyone with a valid room membership can read that room's published state and nothing else.

---

## Design direction: rusty and dusty

The interface should feel like an object from the world, not a modern app laid over it. Warm, worn, low-lit. A field instrument someone repaired with what they had.

**Palette.** Put these in the Tailwind theme as named colours.

- Bone `#ECE0CB`, dim bone `#C8BCA6` (text and light surfaces)
- Ink `#16110B`, ink-2 `#1F1810` (deep warm near-black, never pure black)
- Panel `#231A11`, panel-2 `#2C2117` (raised surfaces)
- Line `#4A3A27` (borders, dividers)
- Ochre `#C8923D`, gold `#E0A94B` (primary accent, the GM's warm light)
- Rust `#A8503A` (warnings, destructive actions, the worn-metal note)
- Teal `#3E8E89`, dim teal `#2C625E` (the player's accent, the "live" colour)
- Fog dust `#4A3F31` (warm, never grey)

Pin colours map to the seven crystal domains: crimson, amber, verdant, azure, violet, pale, void. Use warm, slightly muted versions, nothing neon.

**Type.** Fraunces for display and headings, a weathered high-contrast serif. Spectral for body and reading text. A plain system sans only for the smallest UI labels and numbers, kept quiet.

**Texture.** A faint film grain over the whole app, low opacity, overlay blend. A soft warm vignette at the edges. Borders and panels can feel slightly aged; avoid crisp flat rectangles with hard shadows. The prototype has an SVG noise overlay, reuse that approach.

**Light.** Late-afternoon golden hour is the rule. Warm highlights, warm shadows, low contrast between them. Accents glow softly rather than pop. Nothing is lit from a cold source.

**Motion.** Slow and settling, like dust. Reveals and transitions ease out gently. Avoid snappy, bouncy, modern micro-interactions.

**The fog itself.** Warm drifting dust, not a flat grey screen. On the player side, hidden ground sits under a blurred, dimmed, dust-tinted haze. Revealing it should feel like dust clearing or memory returning, which is the game's central theme.

What to avoid, hard rules:

- No pure white (`#FFFFFF`) and no pure black (`#000000`). Everything is warm-tinted.
- No cold or blue-grey palettes. No corporate SaaS blue.
- No neon, no glassmorphism, no glossy gradients.
- No bright, even, midday lighting. The world has none.
- No clean flat material-design look. This is a worn object, not a dashboard.

---

## Behaviours that must carry over from the prototype

The prototype is in the repo for reference. These specific behaviours were tuned by hand and should survive the rewrite:

- Reveal and hide brushes feather at the edge, no hard line between seen and unseen.
- The GM sees their own fog at reduced opacity so they can work through it. Players see it solid (with the faint blurred hint underneath).
- Semi-reveal produces torn strips that reproduce identically across all screens via a seed, and repeated passes accumulate.
- The publish button shows clearly when there are unpublished changes.
- Pin GM-notes never leave the GM's screen, not in the published payload, not anywhere a player session can read.

---

## Suggested build order

1. Scaffold: Vite, React, TypeScript, Tailwind, Supabase client. Theme colours in.
2. Canvas core: load an image locally, pan, zoom, fit. No database yet.
3. Fog layer: reveal, hide, semi brushes as a client-side stroke list, with undo.
4. Pins: place, edit, drag, delete, client-side.
5. Supabase: GM auth, rooms, map image upload to Storage.
6. Publish: write published_state, bump version, GM working-state autosave.
7. Player view: join by code, subscribe, replay strokes and pins.
8. Live tokens over broadcast (optional, after the above works).
9. Design and texture pass, responsive layout, reconnect handling.

Get steps 2 to 4 solid and good-looking before touching the database. The map experience is the product; the sync is plumbing.

---

## Open questions to decide as you go

- Exact semi-reveal strip parameters (strip size, density, how much each pass opens). Tune live, the prototype values are a starting point.
- Whether players get their own movable tokens, or only the GM moves tokens.
- How many maps a single room should hold, and whether maps carry their own fog independently (they should).
- Whether to keep a full fog-stroke history for replay and undo across sessions, or compact it on publish.
