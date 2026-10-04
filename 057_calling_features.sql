-- 057_calling_features.sql
--
-- Replaces this file's own earlier, never-run draft (calling_role_sync
-- -- a separate calling_role_mappings table auto-syncing a cached
-- profiles.role) with a different design the user asked for minutes
-- after that one was built, on noticing it duplicated the same
-- calling-to-access idea as the pre-existing meeting_type_members
-- table: "I want to eliminate roles. I want the calling table to
-- include a way to select the features that are available to that
-- calling." Deleted and rewritten under the same migration number
-- rather than adding a new one, since the original was never
-- confirmed run (matching this file's own established convention --
-- see migrations `041`/`047`'s history in PROJECT_CONTEXT.md).
--
-- Ten `feature_<name>` boolean columns go directly on `callings` --
-- one per capability the old `profiles.role` used to grant. A person's
-- access is now the union of every true flag across whichever active
-- callings they currently hold (see lib/supabase/get-session-user.ts),
-- computed fresh on every request rather than cached in a column.
-- Holding two callings that both grant a feature is harmless -- flags
-- OR together, so there's no priority/tie-breaking concept needed the
-- way the deleted draft's `calling_role_mappings.priority` was.
--
-- `requires_self_handoff`: a general-purpose guard, not Bishop-specific
-- by name (this app has been burned twice already by guessing a real
-- calling name wrong -- see STAKE_PRESIDENCY_CALLING_NAMES/
-- VISITING_AUTHORITY_CALLING_NAME_PREFIXES's own history) -- the admin
-- flags whichever calling(s) need it themselves, same as they'll flag
-- feature_bishopric themselves. Enforced by enforce_calling_handoff(),
-- a trigger on `callings` that only restricts actually *transferring*
-- a flagged calling from one real holder to a different real one --
-- vacating it (to null) or assigning a first holder when currently
-- vacant stays open to any admin, so a flagged calling can never get
-- permanently stuck if its current holder is unavailable. This is the
-- only way left to preserve "only a sitting Bishop can hand the
-- calling to a successor" now that there's no separate "grant the
-- role" step to gate -- access comes straight from the calling.
--
-- SECURITY INVOKER, matching this repo's own established convention
-- (see `025_apply_rotation_assignment_function.sql`'s own comment) --
-- runs with the privileges of whichever authenticated admin's edit to
-- `callings` fired it (via /callings or Table Admin, both already
-- Bishopric-gated), not bypassing RLS.
--
-- Idempotent: safe to re-run.

alter table callings add column if not exists feature_bishopric boolean not null default false;
alter table callings add column if not exists feature_music_planner boolean not null default false;
alter table callings add column if not exists feature_communications_specialist boolean not null default false;
alter table callings add column if not exists feature_ward_council boolean not null default false;
alter table callings add column if not exists feature_youth_council boolean not null default false;
alter table callings add column if not exists feature_yw_presidency boolean not null default false;
alter table callings add column if not exists feature_yw_advisor boolean not null default false;
alter table callings add column if not exists feature_yw_specialist boolean not null default false;
alter table callings add column if not exists feature_ym_advisor boolean not null default false;
alter table callings add column if not exists feature_ym_specialist boolean not null default false;
alter table callings add column if not exists requires_self_handoff boolean not null default false;

create or replace function enforce_calling_handoff()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_acting_person_id uuid;
begin
  if coalesce(old.requires_self_handoff, false)
     and old.current_holder_id is not null
     and new.current_holder_id is not null
     and new.current_holder_id is distinct from old.current_holder_id
  then
    select id into v_acting_person_id from people where profile_id = auth.uid();
    if v_acting_person_id is distinct from old.current_holder_id then
      raise exception 'Only the current holder of this calling can hand it off to someone else.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists calling_handoff_guard on callings;
create trigger calling_handoff_guard
  before update of current_holder_id on callings
  for each row
  execute function enforce_calling_handoff();
