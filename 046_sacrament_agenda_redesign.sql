-- 046_sacrament_agenda_redesign.sql
--
-- Sacrament Meeting agenda grid redesign (2026-09-09), from the user's
-- own line-by-line notes against a real agenda screenshot:
--
-- 1. Chorister/Organist stop being their own agenda lines -- they're
--    rendered together, inline, on the Recognize Music line instead
--    (application code only; both remain real sacrament_assignments
--    roles and stay tracked by Assignment Rotations exactly as before,
--    this only changes which agenda lines list them separately).
-- 2. Pianist is removed entirely as an agenda line.
-- 3. A new "Sacrament Administered" cue is added right after the
--    Sacrament Hymn, so the agenda groups them under one visual
--    "Administration of the Sacrament" section (application code).
-- 4. Speakers/Youth Speakers/Intermediate Hymn/Musical Numbers move
--    off the fixed per-meeting-type template entirely -- replaced by a
--    freely add/remove/reorderable list scoped to one meeting
--    (sacrament_program_items), so a week can have exactly the mix of
--    speakers, musical numbers, and testimonies it actually needs
--    instead of a fixed template guess.
-- 5. Stake Business becomes a yes/no toggle (has_stake_business) with
--    an optional short "who's announcing" answer, replacing free text
--    describing the business itself.
--
-- Idempotent: safe to re-run.

-- 1. New "Sacrament Administered" catalog element -- a plain script cue
--    (like Announcements/Recognize Music), no data-entry component.
insert into meeting_elements (key, label, resolution_kind, repeatable, max_slots, sort_order)
select 'sacrament_administered', 'Sacrament Administered', 'none', false, null, 135
where not exists (select 1 from meeting_elements where key = 'sacrament_administered');

insert into meeting_element_types (meeting_type_id, element_id)
select (select id from meeting_types where slug = 'sacrament-meeting'), me.id
from meeting_elements me
where me.key = 'sacrament_administered'
  and not exists (
    select 1 from meeting_element_types met
    where met.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
      and met.element_id = me.id
  );

-- Insert it right after Sacrament Hymn in every format that has one --
-- sort_order + 1 always lands strictly before whatever came next
-- (sort_orders step by 10 throughout this catalog).
insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select mt.meeting_type_id, mt.format_key, sa.id, mt.sort_order + 1, null
from meeting_templates mt
join meeting_elements me on me.id = mt.element_id and me.key = 'sacrament_hymn'
cross join (select id from meeting_elements where key = 'sacrament_administered') sa
where mt.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
  and not exists (
    select 1 from meeting_templates existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_type_id = mt.meeting_type_id
      and coalesce(existing.format_key, '') = coalesce(mt.format_key, '')
      and eme.key = 'sacrament_administered'
  );

-- Same, for meetings that already have their own seeded
-- meeting_planned_elements row set (only non-archived ones -- an
-- archived meeting's agenda is the finalized historical record, per
-- app/meetings/[id]/archived, and shouldn't gain a new line after the
-- fact).
insert into meeting_planned_elements (meeting_id, element_id, sort_order, slot_count)
select mpe.meeting_id, sa.id, mpe.sort_order + 1, null
from meeting_planned_elements mpe
join meeting_elements me on me.id = mpe.element_id and me.key = 'sacrament_hymn'
join meetings m on m.id = mpe.meeting_id
cross join (select id from meeting_elements where key = 'sacrament_administered') sa
where m.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
  and m.stage <> 'archived'
  and not exists (
    select 1 from meeting_planned_elements existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_id = mpe.meeting_id
      and eme.key = 'sacrament_administered'
  );

-- 2. Retire Chorister/Organist/Pianist/Speaker/Youth Speaker/Intermediate
--    Hymn as fixed template lines -- across every format_key at once.
--    The meeting_elements catalog rows themselves are untouched (still
--    real, valid sacrament_assignments roles / sacrament_music types --
--    Assignment Rotations and the new Recognize Music line still read
--    and write them directly), only their place in the default agenda
--    templates is removed.
delete from meeting_templates mt
using meeting_elements me
where mt.element_id = me.id
  and mt.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
  and me.key in ('chorister', 'organist', 'pianist', 'youth_speaker', 'speaker', 'intermediate_hymn');

-- Same, for already-seeded non-archived meetings -- otherwise every
-- Sacrament Meeting already in planning would keep showing these as
-- fixed lines until archived, defeating the point of removing them now.
delete from meeting_planned_elements mpe
using meeting_elements me, meetings m
where mpe.element_id = me.id
  and mpe.meeting_id = m.id
  and m.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
  and m.stage <> 'archived'
  and me.key in ('chorister', 'organist', 'pianist', 'youth_speaker', 'speaker', 'intermediate_hymn');

-- 3. Freely add/remove/reorderable Speakers & Music list, scoped to one
--    meeting. item_key matches the exact `slot` value already used in
--    sacrament_speakers_adults/youth.slot and sacrament_music.slot
--    (e.g. "speaker_3", "musical_number_5"), or the bare string
--    "testimony" for an open-testimony placeholder with no underlying
--    data row at all -- this table only tracks *order and membership*,
--    the actual speaker/music data still lives in the existing tables,
--    keyed by that same slot.
create table if not exists sacrament_program_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  item_key text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  unique (meeting_id, item_key)
);

alter table sacrament_program_items enable row level security;

drop policy if exists "authenticated read sacrament_program_items" on sacrament_program_items;
create policy "authenticated read sacrament_program_items"
  on sacrament_program_items for select
  to authenticated
  using (true);

drop policy if exists "authenticated write sacrament_program_items" on sacrament_program_items;
create policy "authenticated write sacrament_program_items"
  on sacrament_program_items for all
  to authenticated
  using (true)
  with check (true);

-- 4. Stake Business: yes/no toggle, replacing free text describing the
--    business itself -- the existing `stake_business` text column is
--    repurposed to hold who's announcing it instead (still just a short
--    string, no shape change needed).
alter table sacrament_planning add column if not exists has_stake_business boolean not null default false;
