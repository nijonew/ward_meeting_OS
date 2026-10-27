-- 087_separate_review_section_elements.sql
--
-- Bishopric Meeting/Ward Council/Youth Council's Review section
-- (migration 078) has always rendered Announcements and Previous
-- Meeting Minutes as one hardcoded, bundled unit
-- (components/planning/ReviewSection.tsx) -- completely outside the
-- normal per-element system every other agenda line now goes through
-- (add/remove/reorder inline, 2026-10-25). The user's own report:
-- "I want to separate 'review' elements in non-sacrament meetings. It
-- looks like previous minutes and announcements have been lumped
-- together and I want them to be separate." Confirmed via
-- AskUserQuestion: make them two real, independent agenda elements --
-- addable/removable/reorderable individually, same as everything else.
--
-- Two new catalog elements, `resolution_kind = 'none'` (read-only,
-- nothing saved through them -- both are synthesized from existing
-- data, same as before, just now rendered as real elements instead of
-- a hardcoded block):
--   - `review_announcements` ("Announcements") -- the same
--     where_announced-driven live read this ward already had.
--   - `previous_meeting_minutes` ("Previous Meeting Minutes") -- the
--     same most-recent-earlier-meeting lookup this ward already had.
-- Deliberately NOT reusing Sacrament Meeting's own `"announcements"`
-- key -- that one means a completely different mechanism (an explicit
-- pull from a standing pool, sacrament_announcement_pulls), and
-- `buildAgendaRows`'s existing `isSacrament && key === "announcements"`
-- dispatch would collide with it.
--
-- **Anchored relative to `review_section`'s own sort_order, not an
-- absolute number** -- more robust than anchoring off spiritual_thought
-- the way migration 078 did, since it only depends on review_section
-- and discussion_section's relative order to each other, not their
-- distance from spiritual_thought. `review_section` and
-- `discussion_section` landed only 1 sort_order unit apart in that
-- migration (no room for anything between them as a plain integer
-- column), so discussion_section and its own three Discussion-section
-- topics (focus_on_people/upcoming_combined_activities/
-- recent_successful_activities) are shifted +10 first, in both
-- meeting_templates and already-seeded meeting_planned_elements, to
-- open up room -- a pure relative shift, safe regardless of their
-- exact current absolute values. **Not verified against live data**
-- (no database access this session) -- same caveat migration 078's
-- own comment already carried; if anything lands out of order once
-- this runs, the fix is a follow-up `update ... set sort_order = ...`
-- by key, not a new migration number.
--
-- Idempotent: every scope (each meeting type's template, each
-- already-seeded meeting) is skipped entirely -- shift included -- if
-- `review_announcements` already exists there, so re-running this
-- migration can never shift twice or double-insert.

do $$
declare
  v_review_announcements_id uuid;
  v_previous_minutes_id uuid;
  v_discussion_cluster_ids uuid[];
  v_meeting_type_id uuid;
  v_meeting_id uuid;
  v_review_sort_order integer;
begin
  insert into meeting_elements (key, label, resolution_kind, repeatable, max_slots, sort_order)
  select 'review_announcements', 'Announcements', 'none', false, null, 0
  where not exists (select 1 from meeting_elements where key = 'review_announcements');

  insert into meeting_elements (key, label, resolution_kind, repeatable, max_slots, sort_order)
  select 'previous_meeting_minutes', 'Previous Meeting Minutes', 'none', false, null, 0
  where not exists (select 1 from meeting_elements where key = 'previous_meeting_minutes');

  select id into v_review_announcements_id from meeting_elements where key = 'review_announcements';
  select id into v_previous_minutes_id from meeting_elements where key = 'previous_meeting_minutes';
  select array_agg(id) into v_discussion_cluster_ids
    from meeting_elements
    where key in ('discussion_section', 'focus_on_people', 'upcoming_combined_activities', 'recent_successful_activities');

  -- Which meeting types each new element applies to -- both to all
  -- three collaborative types (Sacrament Meeting has its own,
  -- different Announcements mechanism and no Minutes concept at all).
  insert into meeting_element_types (meeting_type_id, element_id)
  select mt.id, me.id
  from meeting_types mt
  join meeting_elements me on me.key in ('review_announcements', 'previous_meeting_minutes')
  where mt.slug in ('bishopric-meeting', 'ward-council', 'youth-council')
    and not exists (
      select 1 from meeting_element_types met
      where met.meeting_type_id = mt.id and met.element_id = me.id
    );

  -- Each of the three collaborative types' own default template
  -- (format_key is always null for these -- no special_format concept).
  for v_meeting_type_id in
    select id from meeting_types where slug in ('bishopric-meeting', 'ward-council', 'youth-council')
  loop
    if not exists (
      select 1 from meeting_templates
      where meeting_type_id = v_meeting_type_id and element_id = v_review_announcements_id
    ) then
      select sort_order into v_review_sort_order
      from meeting_templates
      where meeting_type_id = v_meeting_type_id
        and element_id = (select id from meeting_elements where key = 'review_section');

      if v_review_sort_order is not null then
        update meeting_templates
        set sort_order = sort_order + 10
        where meeting_type_id = v_meeting_type_id and element_id = any(v_discussion_cluster_ids);

        insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
        values
          (v_meeting_type_id, null, v_review_announcements_id, v_review_sort_order + 1, null),
          (v_meeting_type_id, null, v_previous_minutes_id, v_review_sort_order + 2, null);
      end if;
    end if;
  end loop;

  -- Same seeding for already-seeded non-archived meetings of these
  -- three types -- otherwise an in-progress meeting keeps the old
  -- bundled rendering until archived.
  for v_meeting_id in
    select m.id
    from meetings m
    where m.meeting_type_id in (select id from meeting_types where slug in ('bishopric-meeting', 'ward-council', 'youth-council'))
      and m.stage <> 'archived'
  loop
    if not exists (
      select 1 from meeting_planned_elements
      where meeting_id = v_meeting_id and element_id = v_review_announcements_id
    ) then
      select sort_order into v_review_sort_order
      from meeting_planned_elements
      where meeting_id = v_meeting_id
        and element_id = (select id from meeting_elements where key = 'review_section');

      if v_review_sort_order is not null then
        update meeting_planned_elements
        set sort_order = sort_order + 10
        where meeting_id = v_meeting_id and element_id = any(v_discussion_cluster_ids);

        insert into meeting_planned_elements (meeting_id, element_id, sort_order, slot_count)
        values
          (v_meeting_id, v_review_announcements_id, v_review_sort_order + 1, null),
          (v_meeting_id, v_previous_minutes_id, v_review_sort_order + 2, null);
      end if;
    end if;
  end loop;
end $$;
