-- The Stranded — Field Map: database schema
-- Run this in the Supabase dashboard → SQL Editor.
--
-- Identity is anonymous: every session (GM or player) is an anonymous auth user,
-- so auth.uid() exists and RLS has something to gate on. No login screen.
--
-- The GM is whoever created the room (rooms.gm_id = their anon uid). Players read
-- published_state; only the room's GM can write it.

-- ── rooms ───────────────────────────────────────────────────────────────────
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Untitled room',
  join_code   text not null unique,
  gm_id       uuid not null,                 -- anon uid of the creator
  created_at  timestamptz not null default now()
);

-- ── published_state ─────────────────────────────────────────────────────────
-- One row per room (single active map for now). Overwritten on each publish.
-- This is the only thing players read.
create table if not exists public.published_state (
  room_id     uuid primary key references public.rooms(id) on delete cascade,
  version     bigint not null,
  width       integer not null,
  height      integer not null,
  image_path  text not null,                 -- object path in the 'maps' bucket
  fog         jsonb not null default '[]',   -- ordered fog ops
  pins        jsonb not null default '[]',   -- public pins (no GM notes)
  grid        jsonb,                          -- optional hex-tile overlay { enabled, size }
  updated_at  timestamptz not null default now()
);

-- If the table already existed before the grid feature, add the column:
alter table public.published_state add column if not exists grid jsonb;

-- ── row level security ───────────────────────────────────────────────────────
alter table public.rooms enable row level security;
alter table public.published_state enable row level security;

-- rooms: anyone signed in (incl. anonymous) may look up a room (needed to join by
-- code). Only the creator may insert/update/delete their own room.
drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms
  for select to authenticated using (true);

drop policy if exists rooms_insert on public.rooms;
create policy rooms_insert on public.rooms
  for insert to authenticated with check (gm_id = auth.uid());

drop policy if exists rooms_update on public.rooms;
create policy rooms_update on public.rooms
  for update to authenticated using (gm_id = auth.uid()) with check (gm_id = auth.uid());

drop policy if exists rooms_delete on public.rooms;
create policy rooms_delete on public.rooms
  for delete to authenticated using (gm_id = auth.uid());

-- published_state: anyone signed in may read; only the room's GM may write.
drop policy if exists ps_select on public.published_state;
create policy ps_select on public.published_state
  for select to authenticated using (true);

drop policy if exists ps_insert on public.published_state;
create policy ps_insert on public.published_state
  for insert to authenticated
  with check (exists (select 1 from public.rooms r where r.id = room_id and r.gm_id = auth.uid()));

drop policy if exists ps_update on public.published_state;
create policy ps_update on public.published_state
  for update to authenticated
  using (exists (select 1 from public.rooms r where r.id = room_id and r.gm_id = auth.uid()))
  with check (exists (select 1 from public.rooms r where r.id = room_id and r.gm_id = auth.uid()));

-- ── realtime ─────────────────────────────────────────────────────────────────
-- Players subscribe to changes on published_state.
alter publication supabase_realtime add table public.published_state;

-- ── storage: the 'maps' bucket ────────────────────────────────────────────────
-- Public read (map images aren't secret once published); only signed-in sessions
-- may upload. Create the bucket then apply the policies.
insert into storage.buckets (id, name, public)
values ('maps', 'maps', true)
on conflict (id) do nothing;

drop policy if exists maps_read on storage.objects;
create policy maps_read on storage.objects
  for select using (bucket_id = 'maps');

drop policy if exists maps_write on storage.objects;
create policy maps_write on storage.objects
  for insert to authenticated with check (bucket_id = 'maps');

drop policy if exists maps_update on storage.objects;
create policy maps_update on storage.objects
  for update to authenticated using (bucket_id = 'maps');
