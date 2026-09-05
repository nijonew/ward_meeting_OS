-- 025_apply_rotation_assignment_function.sql
--
-- Atomic version of the rotation-advance write. lib/data/rotations.ts's
-- applyRotationsToNewMeeting() used to do this as two separate network
-- round trips per rotation: insert the new assignment, then update
-- rotations.next_index. If the second call ever failed after the first
-- succeeded, the "whose turn is next" pointer could desync from what was
-- actually assigned -- silently skipping or repeating someone in a
-- future meeting, with nothing visible to the user when it happened.
--
-- This function does the read-lock-compute-write for one rotation
-- inside a single Postgres function call, which runs as one implicit
-- transaction. It also re-reads next_index live under `for update`
-- instead of trusting a value the caller fetched earlier in a separate
-- query -- closing a second, related race (two meetings for the same
-- rotation being created back to back) that existed alongside the
-- original partial-failure gap.
--
-- No SECURITY DEFINER -- runs with the calling (authenticated) user's
-- own privileges, same as the two direct writes it replaces, so it stays
-- governed by each table's existing RLS policies rather than bypassing
-- them. Consistent with the rest of the app: anon key everywhere, RLS
-- enforced on every table (see PROJECT_CONTEXT.md).
--
-- Idempotent: `create or replace function` is safe to re-run.

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
    insert into sacrament_assignments (meeting_id, role, assigned_to_id, confirmed)
    values (p_meeting_id, p_element_key, v_person_id, false);
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

-- Explicit least-privilege grant, matching this repo's pattern of scoping
-- every write to `authenticated` rather than leaving Postgres defaults in
-- place (functions are PUBLIC-executable unless revoked).
revoke all on function apply_rotation_assignment(uuid, uuid, text, text, uuid[]) from public;
grant execute on function apply_rotation_assignment(uuid, uuid, text, text, uuid[]) to authenticated;
