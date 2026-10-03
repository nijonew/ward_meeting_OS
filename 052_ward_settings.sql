-- 052_ward_settings.sql
--
-- A single-row settings table holding the ward's own display name
-- (2026-10-03, the user's own request: "I would like to take the name
-- Ward OS and make it much less conspicuous... put the title
-- '_______ Ward' in place of where Ward OS was in the header. The
-- '______ Ward' name will be defined by the admin in admin tools").
-- Previously this app's own product name ("Ward OS") doubled as the
-- header wordmark everywhere, with no real per-ward name anywhere an
-- admin could change without a code deploy (lib/config.tsx's old
-- WARD_NAME was an env var, never exposed in the app itself) -- this
-- replaces that with a real, Table-Admin-editable setting.
--
-- Deliberately a singleton (exactly one row) rather than a key/value
-- settings table -- this is the only setting of this kind so far, and
-- a dedicated single-column table is simpler to read/write than a
-- generic key/value scheme would be for just one value.
--
-- Idempotent: safe to re-run (create table if not exists; the seed
-- insert only fires when the table is empty).

create table if not exists ward_settings (
  id uuid primary key default gen_random_uuid(),
  ward_name text not null default 'Heritage',
  updated_at timestamp with time zone not null default now()
);

insert into ward_settings (ward_name)
select 'Heritage'
where not exists (select 1 from ward_settings);

alter table ward_settings enable row level security;

-- The header renders on every page, including fully public ones (the
-- Sacrament Meeting program, login) with no session at all -- anon
-- needs read access, same as the other public-facing tables in this
-- app (announcements, sacrament program data, etc.).
drop policy if exists "public read ward_settings" on ward_settings;
create policy "public read ward_settings"
  on ward_settings for select
  to anon
  using (true);

drop policy if exists "authenticated read ward_settings" on ward_settings;
create policy "authenticated read ward_settings"
  on ward_settings for select
  to authenticated
  using (true);

-- Writable by any authenticated user at the RLS layer, same convention
-- as every other table here -- Table Admin itself is bishopric-only at
-- the page level, which is what actually restricts who can change this.
drop policy if exists "authenticated write ward_settings" on ward_settings;
create policy "authenticated write ward_settings"
  on ward_settings for update
  to authenticated
  using (true)
  with check (true);
