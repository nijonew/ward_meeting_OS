-- 091_people_gender_archive_and_reordering.sql
--
-- Four unrelated schema changes from the same sitting, 2026-10-30,
-- bundled into one migration since they were all requested together:
--
-- 1. `people.gender` -- the user's own request: "I would like to add
--    male/female toggles on the people table (not boolean like the
--    youth toggle)." A plain text column, no CHECK constraint (same
--    reasoning as every other admin-facing vocabulary column in this
--    project's own history) -- rendered as a real two-option dropdown
--    in Table Admin (lib/admin/registry.ts), not a checkbox, per the
--    user's own explicit "not boolean" feedback.
--
-- 2. `people.archived_at` -- the user's own request: "when someone is
--    deleted from the people page they should be added to a new
--    archived people page." People's own Delete button now archives
--    instead of truly deleting (see the new archive_person() function
--    below) -- /admin/archived-people is the new page that lists
--    these back out, with Restore and a genuine permanent-delete
--    option (both confirmed directly with the user).
--
-- 3. `ward_settings.ward_business_section_order` -- the user's own
--    request: "I would like to be able to adjust the order of
--    subsections in the ward business section." A plain text[] of
--    "release"/"new_calling"/"rabnm" in display order -- a single
--    ward-wide preference (same singleton-row shape as the ward's own
--    display name), not per-meeting. Null/missing defaults to the
--    fixed order these three subsections have always rendered in
--    (lib/data/ward-settings.ts's own WARD_BUSINESS_SECTION_KEYS).
--
-- 4. `sacrament_announcement_pulls.sort_order` -- the user's own
--    request: "I need to be able to put announcements in order also
--    in sacrament meetings." Replaces the previous automatic
--    soonest-to-latest sort (2026-10-25) with a real, manually
--    orderable sequence, same Move Up/Down mechanism as Ward
--    Business's own Callings/Releases reorder (migration 090).
--    Backfilled per (meeting_id, planned_element_id) via row_number()
--    * 10, same gap convention as that migration's own backfill.
--
-- All four are purely additive/idempotent -- safe to re-run.

alter table people add column if not exists gender text;
alter table people add column if not exists archived_at timestamptz;

alter table ward_settings add column if not exists ward_business_section_order text[];

alter table sacrament_announcement_pulls add column if not exists sort_order integer;

-- Keyed by the table's own unique (announcement_id, meeting_id) pair,
-- not a surrogate id -- this join table has none.
update sacrament_announcement_pulls p
set sort_order = ranked.rn * 10
from (
  select announcement_id, meeting_id,
    row_number() over (partition by planned_element_id order by meeting_id, announcement_id) as rn
  from sacrament_announcement_pulls
  where sort_order is null
) ranked
where p.announcement_id = ranked.announcement_id and p.meeting_id = ranked.meeting_id;

-- archive_person(): what People's own Delete button calls instead of a
-- real delete (lib/admin/table-data.ts's deleteAdminRow, via the
-- `people` registry entry's new archiveRpc) -- the user's own
-- confirmed choice: "Auto-clear both calling(s) and login link."
-- Clears any calling this person currently holds (vacating it, not
-- reassigning it to anyone) and their login link, then marks them
-- archived. Never deletes the row -- that's the separate, genuine
-- permanent-delete action on /admin/archived-people, a plain DELETE
-- with no function of its own.
drop function if exists archive_person(uuid);
create function archive_person(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update callings set current_holder_id = null where current_holder_id = target_id;
  update people set archived_at = now(), profile_id = null where id = target_id;
end;
$$;
