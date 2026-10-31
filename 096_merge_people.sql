-- 096_merge_people.sql
--
-- The "merge duplicate people" tool (the user's own request: "Yes,
-- design and build it" -- after checking PROJECT_CONTEXT.md's own
-- claim of "paused research" on this and finding none actually
-- existed; see that file's Known open items for the full design
-- discussion). Lets an admin pick two `people` rows that turn out to
-- be the same real person, keep one, and have every other table's
-- reference to the one being removed re-pointed at the survivor
-- before the duplicate row is deleted -- the real fix for the
-- foreign-key error Archived People's own "Delete Permanently" button
-- surfaces as-is rather than attempting itself (migration 091).
--
-- **Catalog-driven, not a hardcoded table list.** This app's own base
-- schema (people, callings, sacrament_assignments, rotation_members,
-- teaching_assignments, calling_planning, and more) predates this
-- repo's migration history entirely -- the same situation as the many
-- undocumented RLS policies/CHECK constraints this project has
-- already hit repeatedly (migrations 038/041/063/067/068/069/075/078).
-- A grep across every migration file for "references people(id)" only
-- turns up the handful of tables created AFTER this repo's history
-- started (youth_class_teachers, sacrament_visiting_authorities,
-- speaker_prayer_history_import, sacrament_rabnm_planning) -- nowhere
-- near the full real list. Rather than guess at (and likely miss) the
-- rest, both functions below discover every foreign key pointing at
-- people(id) from Postgres's own catalog at the moment they run, so
-- they stay correct even against tables/columns this assistant has no
-- live-database way to see.
--
-- One exception the catalog can't find: `calling_planning.candidate_person_ids`
-- is a plain uuid[] column, not a real foreign key -- Postgres cannot
-- enforce an element-wise FK on an array column at all (migration 089's
-- own comment on this exact column). Handled as an explicit special
-- case in both functions below.
--
-- Idempotent: safe to re-run.

-- Preview: how many rows in each table currently reference this
-- person, so the admin can see what a merge would actually move
-- before committing to one. Read-only.
drop function if exists list_people_references(uuid);
create function list_people_references(target_id uuid)
returns table(table_name text, column_name text, row_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  fk record;
  cnt bigint;
begin
  for fk in
    select tc.table_name as tbl, kcu.column_name as col
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name
     and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_name = 'people'
      and ccu.column_name = 'id'
  loop
    execute format('select count(*) from %I where %I = $1', fk.tbl, fk.col)
      into cnt using target_id;
    if cnt > 0 then
      table_name := fk.tbl;
      column_name := fk.col;
      row_count := cnt;
      return next;
    end if;
  end loop;

  select count(*) into cnt from calling_planning where target_id = any(candidate_person_ids);
  if cnt > 0 then
    table_name := 'calling_planning';
    column_name := 'candidate_person_ids';
    row_count := cnt;
    return next;
  end if;
end;
$$;

-- The merge itself. Re-points every discovered reference to remove_id
-- onto keep_id, then deletes the now-unreferenced remove_id row --
-- all inside one function, so it's atomic the same way
-- delete_meeting_cascade (migration 054) already is: a conflict on any
-- one table (e.g. both people already have their own row for the
-- exact same meeting + role, which a blind UPDATE would collide on as
-- a unique-constraint violation) rolls back everything moved so far,
-- never leaves a person half-merged. keep_id's own fields (gender,
-- age_group, notes, login link, etc.) are left exactly as they are --
-- this never tries to auto-merge differing field values, only
-- references; the admin reconciles those by hand first if needed
-- (People/Table Admin), same "don't guess at a conflict" principle as
-- the array-dedupe step below.
drop function if exists merge_people(uuid, uuid);
create function merge_people(keep_id uuid, remove_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fk record;
begin
  if keep_id = remove_id then
    raise exception 'Cannot merge a person into themselves.';
  end if;
  if not exists (select 1 from people where id = keep_id) then
    raise exception 'The person to keep no longer exists.';
  end if;
  if not exists (select 1 from people where id = remove_id) then
    raise exception 'The person to remove no longer exists.';
  end if;

  for fk in
    select tc.table_name as tbl, kcu.column_name as col
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name
     and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_name = 'people'
      and ccu.column_name = 'id'
  loop
    execute format('update %I set %I = $1 where %I = $2', fk.tbl, fk.col, fk.col)
      using keep_id, remove_id;
  end loop;

  -- candidate_person_ids: swap the id, then de-duplicate -- if a row
  -- somehow already named both people as candidates, this collapses
  -- it to one entry instead of leaving keep_id listed twice.
  update calling_planning
  set candidate_person_ids = (
    select array_agg(distinct x)
    from unnest(array_replace(candidate_person_ids, remove_id, keep_id)) as x
  )
  where remove_id = any(candidate_person_ids);

  delete from people where id = remove_id;
end;
$$;

-- Feature catalog row -- deliberately its own gate, not folded into
-- table_admin_people, given how much more this tool can touch than an
-- ordinary People-grid edit (every table in the database, in one
-- click). Nobody gets it automatically; grant it sparingly via
-- /admin/calling-features.
insert into features (key, label, category, sort_order) values
  ('merge_people', 'Merge Duplicate People', 'Tools', 15)
on conflict (key) do nothing;
