-- 034_rotation_recalibration_and_cleanup.sql
-- Renumbered from 033 during the merge with main (which had
-- independently claimed 032 for a different migration by the time this
-- branch merged back in) -- already run under its old number; this file
-- reflects that renumbering for the repo's history, nothing to re-run.
--
-- Three unrelated changes bundled because they came out of the same
-- conversation:
--
-- 1. Drop two unused fields: people.email (never populated/used
--    anywhere in the app) and callings.backup_holder_id (per the user:
--    "not actually a real thing" for this ward).
-- 2. Two new rotation types (Ward Council Spiritual Thought, Youth
--    Council Spiritual Thought) -- the element already exists
--    (spiritual_thought), it just wasn't linked to these two meeting
--    types yet.
-- 3. Recalibrate every generic rotation's member order and "next up"
--    pointer to match the ward's actual real-world rotation pattern
--    (confirmed against a real 2026 schedule spreadsheet in chat),
--    including removing 5 Bishopric members from Ward Council's
--    prayer/thought rotations -- they're standing attendees but never
--    actually take a turn in the real pattern -- and repairing the
--    Sacrament Meeting "conducting" assignment on every existing
--    meeting, which was frozen at creation time before the counselor
--    callings had current holders set.
--
-- Idempotent for parts 1-2. Part 3 (recalibration + repair) is a
-- point-in-time correction, not naturally idempotent the way a schema
-- change is -- re-running it is harmless (it just resets to the same
-- target state again) but it will overwrite any manual edits made to
-- these rotations' member order or existing meetings' conducting
-- assignment since this was last run.

-- ============================================================
-- 1. Drop unused fields
-- ============================================================

alter table people drop column if exists email;
alter table callings drop column if exists backup_holder_id;

-- ============================================================
-- 2. New rotation types: Ward Council / Youth Council Spiritual Thought
-- ============================================================

-- Link the existing spiritual_thought element to these two meeting
-- types (it's currently only linked to bishopric-meeting).
insert into meeting_element_types (meeting_type_id, element_id)
select mt.id, (select id from meeting_elements where key = 'spiritual_thought')
from meeting_types mt
where mt.slug in ('ward-council', 'youth-council')
  and not exists (
    select 1 from meeting_element_types met
    where met.meeting_type_id = mt.id
      and met.element_id = (select id from meeting_elements where key = 'spiritual_thought')
  );

-- Add it to each type's default template too, so new meetings going
-- forward get it seeded automatically (format_key stays null -- only
-- Sacrament Meeting uses format-specific buckets).
insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select
  mt.id,
  null,
  (select id from meeting_elements where key = 'spiritual_thought'),
  coalesce((select max(sort_order) from meeting_templates where meeting_type_id = mt.id and format_key is null), 0) + 10,
  null
from meeting_types mt
where mt.slug in ('ward-council', 'youth-council')
  and not exists (
    select 1 from meeting_templates existing
    where existing.meeting_type_id = mt.id
      and existing.format_key is null
      and existing.element_id = (select id from meeting_elements where key = 'spiritual_thought')
  );

-- New rotation rows for the two new types, standing_attendees-sourced
-- to match how Opening/Closing Prayer already work for these types.
insert into rotations (meeting_type_id, element_key, eligibility_source, next_index)
select mt.id, 'spiritual_thought', 'standing_attendees', 0
from meeting_types mt
where mt.slug in ('ward-council', 'youth-council')
  and not exists (
    select 1 from rotations r where r.meeting_type_id = mt.id and r.element_key = 'spiritual_thought'
  );

-- ============================================================
-- 3. Recalibrate rotation membership order + next-up pointer
-- ============================================================

do $$
declare
  bishopric_st_id uuid;
  bishopric_hdbk_id uuid;
  bishopric_op_id uuid;
  bishopric_cp_id uuid;
  wc_op_id uuid;
  wc_cp_id uuid;
  wc_st_id uuid;
  yc_op_id uuid;
  yc_thought_id uuid;
  yc_cp_id uuid;

  newbold_id uuid; bott_id uuid; nemrow_id uuid; young_id uuid; anderson_id uuid;
  hardman_id uuid; zaugg_id uuid; smith_id uuid; millgate_id uuid; merkling_id uuid; rawlin_id uuid; vanderstappen_id uuid;
  kbott_id uuid; merritt_id uuid; griffin_id uuid; nsmith_id uuid; hull_id uuid; eyoung_id uuid;

  bishop_calling_id uuid; first_counselor_id uuid; second_counselor_id uuid;

  meeting_row record;
  month_idx int;
  correct_person_id uuid;
begin
  -- Rotation ids.
  select r.id into bishopric_st_id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'bishopric-meeting' and r.element_key = 'spiritual_thought';
  select r.id into bishopric_hdbk_id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'bishopric-meeting' and r.element_key = 'handbook_training';
  select r.id into bishopric_op_id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'bishopric-meeting' and r.element_key = 'opening_prayer';
  select r.id into bishopric_cp_id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'bishopric-meeting' and r.element_key = 'closing_prayer';
  select r.id into wc_op_id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'ward-council' and r.element_key = 'opening_prayer';
  select r.id into wc_cp_id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'ward-council' and r.element_key = 'closing_prayer';
  select r.id into wc_st_id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'ward-council' and r.element_key = 'spiritual_thought';
  select r.id into yc_op_id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'youth-council' and r.element_key = 'opening_prayer';
  select r.id into yc_thought_id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'youth-council' and r.element_key = 'spiritual_thought';
  select r.id into yc_cp_id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'youth-council' and r.element_key = 'closing_prayer';

  -- Person ids.
  select id into newbold_id from people where name = 'Nick Newbold';
  select id into bott_id from people where name = 'Andrew Bott';
  select id into nemrow_id from people where name = 'Joe Nemrow';
  select id into young_id from people where name = 'Mark Young';
  select id into anderson_id from people where name = 'Corey Anderson';
  select id into hardman_id from people where name = 'Jeremy Hardman';
  select id into zaugg_id from people where name = 'Jen Zaugg';
  select id into smith_id from people where name = 'Kathy Smith';
  select id into millgate_id from people where name = 'Shauna Millgate';
  select id into merkling_id from people where name = 'Dan Merkling';
  select id into rawlin_id from people where name = 'Braden Rawlin';
  select id into vanderstappen_id from people where name = 'Brandon VanderStappen';
  select id into kbott_id from people where name = 'Kevin Bott';
  select id into merritt_id from people where name = 'Preston William Merritt';
  select id into griffin_id from people where name = 'Dalton Griffin';
  select id into nsmith_id from people where name = 'Naomi Faith Smith';
  select id into hull_id from people where name = 'River Selima Hull';
  select id into eyoung_id from people where name = 'Emery Young';

  -- Bishopric (ST/Handbook/OP/CP): same 5-person cycle for all four,
  -- Newbold->Bott->Nemrow->Young->Anderson. Next Bishopric Meeting from
  -- today lands at N=1, so ST=Bott(1), Handbook=Nemrow(2), OP=Young(3),
  -- CP=Anderson(4).
  if bishopric_st_id is not null then
    update rotation_members set sort_order = 0 where rotation_id = bishopric_st_id and person_id = newbold_id;
    update rotation_members set sort_order = 1 where rotation_id = bishopric_st_id and person_id = bott_id;
    update rotation_members set sort_order = 2 where rotation_id = bishopric_st_id and person_id = nemrow_id;
    update rotation_members set sort_order = 3 where rotation_id = bishopric_st_id and person_id = young_id;
    update rotation_members set sort_order = 4 where rotation_id = bishopric_st_id and person_id = anderson_id;
    update rotations set next_index = 1 where id = bishopric_st_id;
  end if;

  if bishopric_hdbk_id is not null then
    update rotation_members set sort_order = 0 where rotation_id = bishopric_hdbk_id and person_id = newbold_id;
    update rotation_members set sort_order = 1 where rotation_id = bishopric_hdbk_id and person_id = bott_id;
    update rotation_members set sort_order = 2 where rotation_id = bishopric_hdbk_id and person_id = nemrow_id;
    update rotation_members set sort_order = 3 where rotation_id = bishopric_hdbk_id and person_id = young_id;
    update rotation_members set sort_order = 4 where rotation_id = bishopric_hdbk_id and person_id = anderson_id;
    update rotations set next_index = 2 where id = bishopric_hdbk_id;
  end if;

  if bishopric_op_id is not null then
    update rotation_members set sort_order = 0 where rotation_id = bishopric_op_id and person_id = newbold_id;
    update rotation_members set sort_order = 1 where rotation_id = bishopric_op_id and person_id = bott_id;
    update rotation_members set sort_order = 2 where rotation_id = bishopric_op_id and person_id = nemrow_id;
    update rotation_members set sort_order = 3 where rotation_id = bishopric_op_id and person_id = young_id;
    update rotation_members set sort_order = 4 where rotation_id = bishopric_op_id and person_id = anderson_id;
    update rotations set next_index = 3 where id = bishopric_op_id;
  end if;

  if bishopric_cp_id is not null then
    update rotation_members set sort_order = 0 where rotation_id = bishopric_cp_id and person_id = newbold_id;
    update rotation_members set sort_order = 1 where rotation_id = bishopric_cp_id and person_id = bott_id;
    update rotation_members set sort_order = 2 where rotation_id = bishopric_cp_id and person_id = nemrow_id;
    update rotation_members set sort_order = 3 where rotation_id = bishopric_cp_id and person_id = young_id;
    update rotation_members set sort_order = 4 where rotation_id = bishopric_cp_id and person_id = anderson_id;
    update rotations set next_index = 4 where id = bishopric_cp_id;
  end if;

  -- Ward Council (OP/CP/new ST): 7-person cycle, Bishopric members
  -- removed (they're standing attendees but never actually take a turn
  -- in the real pattern). Hardman->Zaugg->Smith->Millgate->Merkling->
  -- Rawlin->VanderStappen. Next Ward Council from today lands at N=2:
  -- OP=Smith(2), CP=Millgate(3), ST=Merkling(4).
  if wc_op_id is not null then
    delete from rotation_members where rotation_id = wc_op_id and person_id in (newbold_id, bott_id, nemrow_id, young_id, anderson_id);
    update rotation_members set sort_order = 0 where rotation_id = wc_op_id and person_id = hardman_id;
    update rotation_members set sort_order = 1 where rotation_id = wc_op_id and person_id = zaugg_id;
    update rotation_members set sort_order = 2 where rotation_id = wc_op_id and person_id = smith_id;
    update rotation_members set sort_order = 3 where rotation_id = wc_op_id and person_id = millgate_id;
    update rotation_members set sort_order = 4 where rotation_id = wc_op_id and person_id = merkling_id;
    update rotation_members set sort_order = 5 where rotation_id = wc_op_id and person_id = rawlin_id;
    update rotation_members set sort_order = 6 where rotation_id = wc_op_id and person_id = vanderstappen_id;
    update rotations set next_index = 2 where id = wc_op_id;
  end if;

  if wc_cp_id is not null then
    delete from rotation_members where rotation_id = wc_cp_id and person_id in (newbold_id, bott_id, nemrow_id, young_id, anderson_id);
    update rotation_members set sort_order = 0 where rotation_id = wc_cp_id and person_id = hardman_id;
    update rotation_members set sort_order = 1 where rotation_id = wc_cp_id and person_id = zaugg_id;
    update rotation_members set sort_order = 2 where rotation_id = wc_cp_id and person_id = smith_id;
    update rotation_members set sort_order = 3 where rotation_id = wc_cp_id and person_id = millgate_id;
    update rotation_members set sort_order = 4 where rotation_id = wc_cp_id and person_id = merkling_id;
    update rotation_members set sort_order = 5 where rotation_id = wc_cp_id and person_id = rawlin_id;
    update rotation_members set sort_order = 6 where rotation_id = wc_cp_id and person_id = vanderstappen_id;
    update rotations set next_index = 3 where id = wc_cp_id;
  end if;

  if wc_st_id is not null then
    insert into rotation_members (rotation_id, person_id, sort_order)
    select wc_st_id, p.id, o.ord
    from (values (hardman_id, 0), (zaugg_id, 1), (smith_id, 2), (millgate_id, 3), (merkling_id, 4), (rawlin_id, 5), (vanderstappen_id, 6)) as o(person_id, ord)
    join people p on p.id = o.person_id
    where not exists (select 1 from rotation_members rm where rm.rotation_id = wc_st_id and rm.person_id = o.person_id);
    update rotations set next_index = 4 where id = wc_st_id;
  end if;

  -- Youth Council (OP/CP/new Thought): 8-person cycle, INCLUDES the
  -- Bishop this time -- matches the real pattern exactly.
  -- Millgate->Bott(Kevin)->Merritt->Griffin->Smith(Naomi)->Hull->
  -- Young(Emery)->Newbold. Next Youth Council from today lands at N=0:
  -- OP=Millgate(0), Thought=Bott(1), CP=Merritt(2).
  if yc_op_id is not null then
    update rotation_members set sort_order = 0 where rotation_id = yc_op_id and person_id = millgate_id;
    update rotation_members set sort_order = 1 where rotation_id = yc_op_id and person_id = kbott_id;
    update rotation_members set sort_order = 2 where rotation_id = yc_op_id and person_id = merritt_id;
    update rotation_members set sort_order = 3 where rotation_id = yc_op_id and person_id = griffin_id;
    update rotation_members set sort_order = 4 where rotation_id = yc_op_id and person_id = nsmith_id;
    update rotation_members set sort_order = 5 where rotation_id = yc_op_id and person_id = hull_id;
    update rotation_members set sort_order = 6 where rotation_id = yc_op_id and person_id = eyoung_id;
    update rotation_members set sort_order = 7 where rotation_id = yc_op_id and person_id = newbold_id;
    update rotations set next_index = 0 where id = yc_op_id;
  end if;

  if yc_cp_id is not null then
    update rotation_members set sort_order = 0 where rotation_id = yc_cp_id and person_id = millgate_id;
    update rotation_members set sort_order = 1 where rotation_id = yc_cp_id and person_id = kbott_id;
    update rotation_members set sort_order = 2 where rotation_id = yc_cp_id and person_id = merritt_id;
    update rotation_members set sort_order = 3 where rotation_id = yc_cp_id and person_id = griffin_id;
    update rotation_members set sort_order = 4 where rotation_id = yc_cp_id and person_id = nsmith_id;
    update rotation_members set sort_order = 5 where rotation_id = yc_cp_id and person_id = hull_id;
    update rotation_members set sort_order = 6 where rotation_id = yc_cp_id and person_id = eyoung_id;
    update rotation_members set sort_order = 7 where rotation_id = yc_cp_id and person_id = newbold_id;
    update rotations set next_index = 2 where id = yc_cp_id;
  end if;

  if yc_thought_id is not null then
    insert into rotation_members (rotation_id, person_id, sort_order)
    select yc_thought_id, p.id, o.ord
    from (values (millgate_id, 0), (kbott_id, 1), (merritt_id, 2), (griffin_id, 3), (nsmith_id, 4), (hull_id, 5), (eyoung_id, 6), (newbold_id, 7)) as o(person_id, ord)
    join people p on p.id = o.person_id
    where not exists (select 1 from rotation_members rm where rm.rotation_id = yc_thought_id and rm.person_id = o.person_id);
    update rotations set next_index = 1 where id = yc_thought_id;
  end if;

  -- Repair Sacrament Meeting "conducting" on every existing meeting --
  -- this was computed once at creation time, before the counselor
  -- callings had current holders set, so it's frozen wrong (or missing)
  -- regardless of what today's (correct) calling data says.
  select current_holder_id into bishop_calling_id from callings where name = 'Bishop' and active = true;
  select current_holder_id into first_counselor_id from callings where name = 'Bishopric First Counselor' and active = true;
  select current_holder_id into second_counselor_id from callings where name = 'Bishopric Second Counselor' and active = true;

  for meeting_row in
    select m.id, m.date
    from meetings m
    join meeting_types mt on mt.id = m.meeting_type_id
    where mt.slug = 'sacrament-meeting'
  loop
    month_idx := (extract(month from meeting_row.date)::int - 1) % 3;
    correct_person_id := case month_idx
      when 0 then bishop_calling_id
      when 1 then first_counselor_id
      else second_counselor_id
    end;

    if correct_person_id is not null then
      delete from sacrament_assignments where meeting_id = meeting_row.id and role = 'conducting';
      insert into sacrament_assignments (meeting_id, role, assigned_to_id, confirmed)
      values (meeting_row.id, 'conducting', correct_person_id, false);
    end if;
  end loop;
end $$;
