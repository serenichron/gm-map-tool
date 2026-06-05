# NPCs — design & build plan

Status: **planned, not built.** Decisions below are locked; phasing at the end.

NPCs are people/creatures on the map, distinct from place pins: they have identity
(portrait, role, faction), they move during play, and crucially they have a
**hidden true position** the GM tracks separately from the **last-known position**
players see.

## Locked decisions

- **Toggle now, entity later.** An NPC is a marker with `kind: 'npc'` (vs `'place'`); the pin drawer gets an NPC mode. The data is shaped so an NPC can later be promoted to a campaign-roster entity (build once, drop on any map).
- **Reveal-to-players = the existing GM-only flag.** A hidden NPC is just `gmOnly` (already built); no separate reveal system.
- **Per-field player visibility.** The GM decides field-by-field what players can see (each field has a "show to players" toggle). Sensible defaults; everything else GM-only.
- **Dual position** (see below) — the headline NPC feature.
- **Marker = map-pin + torso**, portrait inside the token, disposition ring.
- **Connections** to other NPCs/pins are in (not "advanced").
- **Optional tracks** (named counters) included.
- **Items** = a simple list the GM can add to.

## Dual position (hidden movement)

Every NPC carries two points:

- **Last-known** `(x, y)` — what players see. This is the published position.
- **True / current** `(gmX, gmY)` — GM-only; where the NPC actually is. Never sent to players.

Behaviour:
- **GM map shows both**, with distinct markers + a **dashed line with an arrow** from last-known → true (the NPC's real whereabouts vs where the party last saw it).
- **The GM can drag either point independently.** Use case: the NPC is shadowing the party, so the GM nudges the *last-known* marker to keep players' picture current, while separately positioning the *true* marker for an ambush elsewhere.
- **Players only ever get last-known.** Moving the true marker tells them nothing.
- A quick action **"reveal current position"** sets last-known := true (publish where they really are), e.g. the moment the NPC steps into view.
- If `gmX/gmY` is unset, true = last-known (a normal NPC that isn't being secretly maneuvered).

Marker styling (to refine in build): last-known = a faded "echo" token; current = the solid portrait token; dashed arrow between. Both obey under/over-fog and GM-only.

## Marker design (pin + torso)

- The teardrop map-pin, but the head reads as a **person**: a torso/shoulders silhouette with the **portrait** filling the head (circular crop). No portrait → a torso/bust glyph.
- **Disposition ring** around the head: friendly / neutral / hostile / unknown → colour.
- Tip still marks the exact spot; counter-scaled + crisp like pins.

## Fields

Marked default visibility (GM can override each).

**Identity**
- Name — *player*
- Portrait (image upload → Storage, like maps) — *player*
- Role / title — *player*
- Species / kind — *player*
- Faction / allegiance (extendable dropdown) — GM (toggle)

**At-a-glance**
- Disposition (Friendly / Neutral / Hostile / Unknown) — GM (toggle); drives ring
- Status (Alive / Wounded / Dead / Fled / Hidden / Unknown) — GM (toggle)
- Colour + icon (reuse pin palette)

**Knowledge**
- Player description — *player*
- GM notes (secrets, motives) — GM-only, never toggleable
- "How to play them" (voice/mannerism) — GM-only

**Depth**
- Goals / agenda — GM
- Tags / keywords — GM (search later)
- **Tracks** — optional named counters `{ label, value, max? }`; each track individually shareable (e.g. show a "Wounds" track to players)
- **Connections** — list of links to other NPCs/pins `{ targetId, label? }`; tap to jump to the target. Optionally drawn as faint lines on the GM map.

**Items**
- Simple list `{ name, note?, shown? }`; GM adds rows; `shown` flips an item player-visible.

## Per-field visibility

- Each shareable field carries a `share` flag (`Record<fieldKey, boolean>` on the NPC).
- `toPublicNpc()` (wire layer) emits **only** shared fields + last-known position; strips GM notes, true position, unshared fields, and unshared items/tracks.
- Defaults: name, portrait, role, species, player description shared; disposition/status/faction/goals/tags/tracks/items hidden until toggled.

## Player view

- Tapping a revealed NPC opens a popover like the pin note, but richer: portrait, name, and whatever fields the GM shared. Shows at the **last-known** position.
- A hidden (`gmOnly`) NPC isn't sent at all.

## Data model sketch (extends Pin)

```
kind?: 'place' | 'npc'              // default 'place'
// npc-only:
portrait?: string                   // storage path
role?, species?, faction?: string
disposition?: 'friendly'|'neutral'|'hostile'|'unknown'
status?: 'alive'|'wounded'|'dead'|'fled'|'hidden'|'unknown'
voice?, goals?: string              // GM-only
tags?: string[]
tracks?: { id, label, value, max?, shown? }[]
items?:  { id, name, note?, shown? }[]
connections?: { id, targetId, label? }[]
gmX?, gmY?: number                  // true position (GM-only); x,y = last-known
share?: Record<string, boolean>     // per-field player visibility
```

Transport: `toPublicNpc` mirrors `toPublicPins` — drops `gmX/gmY`, `gmNote`, `voice`, `goals`, and any field/item/track not shared.

## Phasing

1. **NPC mode in the drawer:** type toggle; name, portrait upload, role, disposition (ring), status; pin+torso marker; player/GM notes; per-field share toggles. Placeable + publishes (single position).
2. **Dual position:** last-known + true markers on the GM map, dashed arrow, independent drag, "reveal current position". Players get last-known.
3. **Items + faction + tags + tracks** (with per-row/track share).
4. **Connections** (list + jump; optional GM-map lines).
5. **Roster** (build once, drop on maps) — ties into multiple-maps.
6. **Live token movement** over the realtime channel.

## Open questions

- Where do shared NPC fields ride to players — extend `published_state.pins`, or a new `npcs` payload? (Likely reuse pins with `kind`.)
- Should the true-position dashed arrow also show on the GM **preview**, or only the editing map? (Editing only — it's a GM tool.)
- Portrait crop/resize on upload to keep tokens light?
