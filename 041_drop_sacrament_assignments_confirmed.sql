-- 041_drop_sacrament_assignments_confirmed.sql
--
-- Drops sacrament_assignments.confirmed (Presiding/Conducting/Chorister/
-- Organist/prayers/spiritual-thought-style rows). Per the user
-- (2026-09-08): every assignment is now treated as print-ready the
-- moment it's filled -- no separate per-row confirm step -- matching how
-- bishopric_assignments (Bishopric Meeting/Ward Council/Youth Council)
-- has worked all along, since that table never had this column at all.
-- What actually gates the public program is the meeting's own stage
-- (ready/live), per the Vision & Intended Workflows section of
-- PROJECT_CONTEXT.md -- this column was a second, redundant readiness
-- flag nothing in that workflow actually calls for.
--
-- NOT the same as sacrament_speakers_adults/youth.confirmed, which
-- stays exactly as-is (Table Admin update queue item 5, 2026-09-05: an
-- archived+confirmed speaker row is what /speaker-prayer-history counts
-- as "recently had a turn" -- unrelated concept, unrelated column, on a
-- different pair of tables).
--
-- Idempotent: `drop policy if exists`, `drop column if exists`, and
-- `create or replace function` are all safe to re-run.
--
-- First attempt at this migration failed in production with:
--   ERROR: 2BP01: cannot drop column confirmed of table
--   sacrament_assignments because other objects depend on it
--   DETAIL: policy "public can view confirmed assignments" ... depends
--   on column confirmed ...; policy "public read confirmed" ... depends
--   on column confirmed ...
-- Both anon-facing RLS policies predate this repo's migration history
-- (never captured in a file, same situation migration 038 found for
-- the bishopric_assignments check constraint) -- they gated the public
-- Sacrament Meeting program's anon read access on confirmed = true.
-- Dropped explicitly below and replaced with a single policy gated on
-- the meeting's own stage instead, matching the new rule this migration
-- establishes app-wide: the meeting's stage (ready/live), not a
-- per-row flag, is what makes an assignment visible to the public.

drop policy if exists "public can view confirmed assignments" on sacrament_assignments;
drop policy if exists "public read confirmed" on sacrament_assignments;

alter table sacrament_assignments drop column if exists confirmed;

drop policy if exists "public read ready sacrament assignments" on sacrament_assignments;
create policy "public read ready sacrament assignments"
  on sacrament_assignments for select
  to anon
  using (
    exists (
      select 1 from meetings
      where meetings.id = sacrament_assignments.meeting_id
        and meetings.stage in ('ready', 'live')
    )
  );

-- Re-defines apply_rotation_assignment (migration 025) without the
-- confirmed argument to its sacrament_assignments insert -- the column
-- no longer exists. Everything else about the function (atomic
-- read-lock-compute-write, security invoker, per-rotation pointer
-- advance) is unchanged.
create or replace function apply_rotation_assignment(
  p_rotation_id uuid,
  p_meeting_id uuid,
  p_element_key text,
  p_target text, -- 'sacrament_assignments' | 'bishopric_assignments' | 'element_notes'
  p_member_ids uuid[] -- rotation's members, already sorted by sort_order
) returns void
language plpgsql
security invoker
as $$
declare
  v_next_index integer;
  v_count integer;
  v_index integer;
  v_person_id uuid;
begin
  v_count := coalesce(array_length(p_member_ids, 1), 0);
  if v_count = 0 then
    return;
  end if;

  select next_index into v_next_index
  from rotations
  where id = p_rotation_id
  for update;

  if not found then
    raise exception 'apply_rotation_assignment: rotation % not found', p_rotation_id;
  end if;

  v_index := v_next_index % v_count;
  v_person_id := p_member_ids[v_index + 1]; -- Postgres arrays are 1-indexed

  if p_target = 'element_notes' then
    insert into meeting_element_notes (meeting_id, element_key, person_id)
    values (p_meeting_id, p_element_key, v_person_id)
    on conflict (meeting_id, element_key)
    do update set person_id = excluded.person_id;
  elsif p_target = 'sacrament_assignments' then
    insert into sacrament_assignments (meeting_id, role, assigned_to_id)
    values (p_meeting_id, p_element_key, v_person_id);
  elsif p_target = 'bishopric_assignments' then
    insert into bishopric_assignments (meeting_id, role, assigned_to_id)
    values (p_meeting_id, p_element_key, v_person_id);
  else
    raise exception 'apply_rotation_assignment: unknown target %', p_target;
  end if;

  update rotations
  set next_index = (v_index + 1) % v_count
  where id = p_rotation_id;
end;
$$;

revoke all on function apply_rotation_assignment(uuid, uuid, text, text, uuid[]) from public;
grant execute on function apply_rotation_assignment(uuid, uuid, text, text, uuid[]) to authenticated;
