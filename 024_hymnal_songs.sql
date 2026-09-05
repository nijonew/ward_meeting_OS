-- 024_hymnal_songs.sql
--
-- Reference table of hymn/song numbers and titles across the three
-- current music collections, for the Sacrament Meeting Music admin grid
-- and (eventually) a proper hymn picker instead of typing a bare number.
-- Structure only -- NOT seeded with real hymn data yet (see chat: typing
-- ~500+ titles from memory risks real inaccuracies in an actual church
-- program, so that needs a proper source rather than a guess).
--
-- Idempotent: safe to re-run (create table if not exists).

create table if not exists hymnal_songs (
  id uuid primary key default gen_random_uuid(),
  songbook text not null check (songbook in ('hymns_for_home_and_church', 'hymns_1985', 'childrens_songbook')),
  number integer not null,
  title text not null,
  created_at timestamp with time zone not null default now(),
  unique (songbook, number)
);

alter table hymnal_songs enable row level security;

drop policy if exists "authenticated read hymnal_songs" on hymnal_songs;
create policy "authenticated read hymnal_songs"
  on hymnal_songs for select
  to authenticated
  using (true);

drop policy if exists "authenticated write hymnal_songs" on hymnal_songs;
create policy "authenticated write hymnal_songs"
  on hymnal_songs for all
  to authenticated
  using (true)
  with check (true);
