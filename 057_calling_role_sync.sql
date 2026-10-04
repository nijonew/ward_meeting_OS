-- 057_calling_role_sync.sql
--
-- Automatic profiles.role sync from calling holder changes (2026-10-04,
-- the user's own request: "as their calling changes their role will
-- change also and update their access" -- explicitly chosen "fully
-- automatic" over a manual-only alternative when asked directly).
--
-- New calling_role_mappings: admin-configured, which calling maps to
-- which app role (editable via Table Admin, like any other small
-- admin-configurable lookup table in this app -- admin_select_options,
-- youth_class_teachers). One role per calling; `priority` (lower =
-- higher) breaks ties when one person holds more than one mapped
-- calling at once.
--
-- Seeded with one row per EXISTING calling, `role` left null and
-- `priority` defaulted from that calling's own `sort_order` (the
-- user's own follow-up request: "add every calling into the
-- table/page so I don't have to manually add them. Then I can
-- manually assign the roles") -- `role` is nullable specifically so
-- this bulk seed can insert a placeholder for every calling, most of
-- which have nothing to do with any app role and are meant to just
-- stay blank forever. A null-role row is never treated as a real
-- mapping anywhere below (every query that picks "the mapped role"
-- explicitly filters `role is not null`) -- without that filter, a
-- blank row with a lower `priority` number than a real mapped one
-- could have incorrectly outranked it when the same person holds
-- both callings.
--
-- "general" (added the same day, the user's own follow-up: "we
-- probably need another role which gives no extra access") is a real,
-- assignable/mappable role like any other here -- it grants nothing
-- anywhere in the app (every permission check is an exact match
-- against a specific role string, and "general" never appears in any
-- of them), but being a real non-null value still gets its holder out
-- of the Verify Logins "needs verification" queue. Lets most of the
-- bulk-seeded callings below map to something sensible (most wards
-- have far more ordinary callings than ones that need a real app
-- permission) instead of forcing a choice between "leave unmapped" and
-- "grant real access nobody intended."
--
-- "bishop" is deliberately NOT an allowed value here -- granting it is
-- restricted to a sitting Bishop only (app/admin/verify-logins/actions.ts's
-- own isBishop check against the ACTING admin). A database trigger has
-- no clean equivalent of "who's acting" to enforce that same rule, so
-- Bishop succession stays a deliberate, manual action through Verify
-- Logins, completely untouched by this migration.
--
-- New profiles.role_source ('manual' | 'auto'): the sync below only
-- ever overwrites a role it determined itself -- never one an admin
-- deliberately chose that doesn't match what the calling mapping would
-- produce. Verify Logins (verifyLogin) decides which tag to write by
-- comparing the admin's chosen role against what this same mapping
-- would derive for that person at verification time: if they match,
-- it's tagged 'auto' (so this person DOES get automatic updates going
-- forward -- this is the common case, since most verifications are
-- exactly "set their role to match their calling"); if the admin chose
-- something the mapping wouldn't have produced, it's tagged 'manual'
-- (a deliberate override, protected from ever being silently
-- overwritten by a later, unrelated calling change).
--
-- All functions below are SECURITY INVOKER, matching this repo's own
-- established convention (see 025_apply_rotation_assignment_function.sql's
-- own comment) -- they run with the privileges of whichever
-- authenticated admin's edit to `callings` fired them (via /callings or
-- Table Admin, both already Bishopric-gated), governed by the same RLS
-- policies that already let Verify Logins' own plain profiles.role
-- update succeed, rather than bypassing RLS with SECURITY DEFINER.
--
-- recompute_role_for_person(): given a people.id, finds every calling
-- they currently hold, picks the highest-priority mapped one with a
-- real (non-null) role (if any), and sets their linked profile's role
-- to match -- or back to null if none of their current callings have
-- a real mapped role. No-ops entirely for a profile tagged 'manual',
-- or one with no linked person at all.
--
-- sync_calling_role(): trigger function on callings, fired after an
-- INSERT or an UPDATE that changes current_holder_id -- recomputes
-- both the previous holder (who may have just lost a mapped calling)
-- and the new holder (who may have just gained one). Fires regardless
-- of which UI path changed the calling (the bespoke /callings page, or
-- Table Admin's generic grid), since it's a real trigger on the table
-- itself, not hooked into any one specific code path.
--
-- sync_all_calling_roles(): the manual catch-up version -- recomputes
-- every person who currently holds a calling with a real mapped role,
-- for after a brand-new (non-null) mapping is set -- that alone
-- doesn't retroactively touch anyone already holding that calling,
-- since nothing fires a trigger on calling_role_mappings itself.
-- Exposed as a "Sync roles now" button on /admin/verify-logins.
--
-- Idempotent: safe to re-run -- the seed only inserts a row for a
-- calling that doesn't already have one, never touches a role an
-- admin has since set.

create table if not exists calling_role_mappings (
  id uuid primary key default gen_random_uuid(),
  calling_id uuid not null unique references callings(id) on delete cascade,
  role text check (role in (
    'bishopric',
    'general',
    'music_planner',
    'communications_specialist',
    'yw_presidency',
    'yw_advisor',
    'yw_specialist',
    'ym_advisor',
    'ym_specialist'
  )),
  priority integer not null default 0,
  created_at timestamp with time zone not null default now()
);

-- In case this ran once already under an earlier version of this file
-- (before `role` was made nullable for the bulk seed below, and before
-- "general" was added as a mappable value).
alter table calling_role_mappings alter column role drop not null;
alter table calling_role_mappings drop constraint if exists calling_role_mappings_role_check;
alter table calling_role_mappings add constraint calling_role_mappings_role_check
  check (role is null or role in (
    'bishopric',
    'general',
    'music_planner',
    'communications_specialist',
    'yw_presidency',
    'yw_advisor',
    'yw_specialist',
    'ym_advisor',
    'ym_specialist'
  ));

-- Migration 056 created profiles_role_check before "general" existed
-- (the user's own follow-up request, 2026-10-04: "we probably need
-- another role which gives no extra access") -- 056 is already
-- confirmed run in production, so it can't be amended in place the
-- way this still-unrun file can; widening its constraint happens here
-- instead, by the same name it already used.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role is null or role in (
    'bishop',
    'bishopric',
    'general',
    'music_planner',
    'communications_specialist',
    'yw_presidency',
    'yw_advisor',
    'yw_specialist',
    'ym_advisor',
    'ym_specialist'
  ));

alter table calling_role_mappings enable row level security;

drop policy if exists "authenticated read calling_role_mappings" on calling_role_mappings;
create policy "authenticated read calling_role_mappings"
  on calling_role_mappings for select
  to authenticated
  using (true);

drop policy if exists "authenticated write calling_role_mappings" on calling_role_mappings;
create policy "authenticated write calling_role_mappings"
  on calling_role_mappings for all
  to authenticated
  using (true)
  with check (true);

insert into calling_role_mappings (calling_id, role, priority)
select c.id, null, coalesce(c.sort_order, 0)
from callings c
where not exists (
  select 1 from calling_role_mappings crm where crm.calling_id = c.id
);

alter table profiles add column if not exists role_source text;

create or replace function recompute_role_for_person(p_person_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_profile_id uuid;
  v_role_source text;
  v_new_role text;
begin
  select profile_id into v_profile_id from people where id = p_person_id;
  if v_profile_id is null then
    return;
  end if;

  select role_source into v_role_source from profiles where id = v_profile_id;
  if v_role_source = 'manual' then
    return;
  end if;

  select crm.role into v_new_role
  from callings c
  join calling_role_mappings crm on crm.calling_id = c.id
  where c.current_holder_id = p_person_id
    and crm.role is not null
  order by crm.priority asc
  limit 1;

  update profiles
  set role = v_new_role, role_source = 'auto'
  where id = v_profile_id;
end;
$$;

revoke all on function recompute_role_for_person(uuid) from public;
grant execute on function recompute_role_for_person(uuid) to authenticated;

create or replace function sync_calling_role()
returns trigger
language plpgsql
security invoker
as $$
begin
  if (tg_op = 'UPDATE' and old.current_holder_id is distinct from new.current_holder_id) then
    if old.current_holder_id is not null then
      perform recompute_role_for_person(old.current_holder_id);
    end if;
  end if;

  if new.current_holder_id is not null then
    perform recompute_role_for_person(new.current_holder_id);
  end if;

  return new;
end;
$$;

drop trigger if exists calling_role_sync on callings;
create trigger calling_role_sync
  after insert or update of current_holder_id on callings
  for each row
  execute function sync_calling_role();

create or replace function sync_all_calling_roles()
returns void
language plpgsql
security invoker
as $$
declare
  v_person_id uuid;
begin
  for v_person_id in
    select distinct c.current_holder_id
    from callings c
    join calling_role_mappings crm on crm.calling_id = c.id
    where c.current_holder_id is not null
      and crm.role is not null
  loop
    perform recompute_role_for_person(v_person_id);
  end loop;
end;
$$;

revoke all on function sync_all_calling_roles() from public;
grant execute on function sync_all_calling_roles() to authenticated;
