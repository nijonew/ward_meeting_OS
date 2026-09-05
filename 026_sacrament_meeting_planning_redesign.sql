-- 026_sacrament_meeting_planning_redesign.sql
--
-- Table Admin queue item 3: makes meeting agendas per-meeting instead of
-- shared per-type, and makes special_format actually change which
-- elements appear (it was previously just a label). See PROJECT_CONTEXT.md
-- and the design conversation for full background.
--
-- IMPORTANT DISCOVERY during this migration's design: meeting_templates
-- currently has ZERO rows for sacrament-meeting in production -- there is
-- no existing "standard" template to relabel. The 'standard' bucket below
-- is therefore authored from scratch from the user's actual real service
-- order (confirmed in chat, not guessed), not derived from existing data.
-- Every format's content came from the user directly except
-- primary_program, christmas_meeting, easter_meeting, and baby_blessing,
-- which default to a plain copy of 'standard' -- flagged in each section
-- below as needing the user's review via /admin/meeting-templates.
--
-- Missionary speakers reuse the existing "speaker" slots (per the user's
-- choice) rather than getting a distinct catalog role -- note in the
-- topic/guest-name field that a given speaker slot is a missionary.
--
-- Idempotent: every statement below is safe to re-run.

-- 1. meeting_templates gains format_key. NULL means "the one default
--    template" for every non-Sacrament meeting type (unchanged
--    behavior); Sacrament Meeting rows get one bucket per special_format
--    value instead.
alter table meeting_templates add column if not exists format_key text;

-- 2. Two new catalog elements needed for the real service order -- both
--    plain script cues (like Announcements/Agenda Items), no data-entry
--    component of their own.
insert into meeting_elements (key, label, resolution_kind, repeatable, max_slots, sort_order)
select 'recognize_music', 'Recognize Music', 'none', false, null, 75
where not exists (select 1 from meeting_elements where key = 'recognize_music');

insert into meeting_elements (key, label, resolution_kind, repeatable, max_slots, sort_order)
select 'primary_program', 'Primary Program', 'none', false, null, 145
where not exists (select 1 from meeting_elements where key = 'primary_program');

insert into meeting_element_types (meeting_type_id, element_id)
select (select id from meeting_types where slug = 'sacrament-meeting'), me.id
from meeting_elements me
where me.key in ('recognize_music', 'primary_program')
  and not exists (
    select 1 from meeting_element_types met
    where met.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
      and met.element_id = me.id
  );

-- 3. Format buckets. Each block only inserts if that format_key has no
--    rows yet for Sacrament Meeting, so re-running this file is a no-op.

-- STANDARD -- the user's real "typical Sunday" order.
insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select (select id from meeting_types where slug = 'sacrament-meeting'), 'standard', me.id, v.sort_order, v.slot_count
from (values
  ('presiding', 10, null::int),
  ('conducting', 20, null),
  ('chorister', 30, null),
  ('organist', 40, null),
  ('pianist', 50, null),
  ('visiting_authorities', 60, null),
  ('announcements', 70, null),
  ('opening_hymn', 80, null),
  ('opening_prayer', 90, null),
  ('recognize_music', 100, null),
  ('ward_business', 110, null),
  ('stake_business', 120, null),
  ('sacrament_hymn', 130, null),
  ('youth_speaker', 140, 2),
  ('speaker', 150, 2),
  ('intermediate_hymn', 160, 1),
  ('closing_hymn', 170, null),
  ('closing_prayer', 180, null)
) as v(key, sort_order, slot_count)
join meeting_elements me on me.key = v.key
where not exists (
  select 1 from meeting_templates existing
  where existing.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
    and existing.format_key = 'standard'
);

-- TESTIMONY_MEETING -- the user's real "fast Sunday" order: no speakers,
-- Testimony Sharing instead.
insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select (select id from meeting_types where slug = 'sacrament-meeting'), 'testimony_meeting', me.id, v.sort_order, v.slot_count
from (values
  ('presiding', 10, null::int),
  ('conducting', 20, null),
  ('chorister', 30, null),
  ('organist', 40, null),
  ('pianist', 50, null),
  ('visiting_authorities', 60, null),
  ('announcements', 70, null),
  ('opening_hymn', 80, null),
  ('opening_prayer', 90, null),
  ('recognize_music', 100, null),
  ('ward_business', 110, null),
  ('stake_business', 120, null),
  ('sacrament_hymn', 130, null),
  ('testimony_sharing', 140, null),
  ('closing_hymn', 150, null),
  ('closing_prayer', 160, null)
) as v(key, sort_order, slot_count)
join meeting_elements me on me.key = v.key
where not exists (
  select 1 from meeting_templates existing
  where existing.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
    and existing.format_key = 'testimony_meeting'
);

-- MISSIONARY_SPEAKER -- the user's "1 missionary speaker" variant
-- (missionary + youth speaker + regular speaker, interspersed with
-- intermediate hymn/musical number). Missionary occupies one of the two
-- "speaker" slots -- note it in that slot's topic/guest name field.
insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select (select id from meeting_types where slug = 'sacrament-meeting'), 'missionary_speaker', me.id, v.sort_order, v.slot_count
from (values
  ('presiding', 10, null::int),
  ('conducting', 20, null),
  ('chorister', 30, null),
  ('organist', 40, null),
  ('pianist', 50, null),
  ('visiting_authorities', 60, null),
  ('announcements', 70, null),
  ('opening_hymn', 80, null),
  ('opening_prayer', 90, null),
  ('recognize_music', 100, null),
  ('ward_business', 110, null),
  ('stake_business', 120, null),
  ('sacrament_hymn', 130, null),
  ('youth_speaker', 140, 1),
  ('speaker', 150, 2),
  ('intermediate_hymn', 160, 1),
  ('closing_hymn', 170, null),
  ('closing_prayer', 180, null)
) as v(key, sort_order, slot_count)
join meeting_elements me on me.key = v.key
where not exists (
  select 1 from meeting_templates existing
  where existing.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
    and existing.format_key = 'missionary_speaker'
);

-- STAKE_SPEAKERS -- confirmed identical to Standard (stake leaders just
-- fill the existing Speaker slots).
-- PRIMARY_PROGRAM, CHRISTMAS_MEETING, EASTER_MEETING, BABY_BLESSING --
-- NOT confirmed by the user. Defaulted to a plain copy of Standard as a
-- starting point -- please review and adjust via /admin/meeting-templates.
do $$
declare
  fmt text;
begin
  foreach fmt in array array['stake_speakers', 'christmas_meeting', 'easter_meeting', 'baby_blessing']
  loop
    insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
    select mt.meeting_type_id, fmt, mt.element_id, mt.sort_order, mt.slot_count
    from meeting_templates mt
    where mt.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
      and mt.format_key = 'standard'
      and not exists (
        select 1 from meeting_templates existing
        where existing.meeting_type_id = mt.meeting_type_id and existing.format_key = fmt
      );
  end loop;
end $$;

-- PRIMARY_PROGRAM -- NOT confirmed by the user (their message didn't
-- cover this Sunday type). Best-effort guess: standard leadership roles,
-- opening hymn/prayer, ward business, sacrament hymn, then the program
-- itself in place of speakers, ending without a separate closing hymn
-- (many Primary programs close with the children's own number). Please
-- correct via /admin/meeting-templates.
insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select (select id from meeting_types where slug = 'sacrament-meeting'), 'primary_program', me.id, v.sort_order, v.slot_count
from (values
  ('presiding', 10, null::int),
  ('conducting', 20, null),
  ('chorister', 30, null),
  ('organist', 40, null),
  ('pianist', 50, null),
  ('announcements', 60, null),
  ('opening_hymn', 70, null),
  ('opening_prayer', 80, null),
  ('recognize_music', 90, null),
  ('ward_business', 100, null),
  ('sacrament_hymn', 110, null),
  ('primary_program', 120, null),
  ('closing_prayer', 130, null)
) as v(key, sort_order, slot_count)
join meeting_elements me on me.key = v.key
where not exists (
  select 1 from meeting_templates existing
  where existing.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
    and existing.format_key = 'primary_program'
);

-- STAKE_CONFERENCE / GENERAL_CONFERENCE -- no ward-run meeting happens;
-- seeded with a single Ward Business row as a place to note "participate
-- in Stake Conference" / "watch General Conference" (the user's own
-- suggestion), rather than a full agenda.
insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select (select id from meeting_types where slug = 'sacrament-meeting'), fmt, (select id from meeting_elements where key = 'ward_business'), 10, null
from (values ('stake_conference'), ('general_conference')) as f(fmt)
where not exists (
  select 1 from meeting_templates existing
  where existing.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
    and existing.format_key = f.fmt
);

-- 4. New table: a meeting's own agenda elements, seeded from the
--    matching default template at creation time, then freely editable
--    per meeting without affecting any other meeting or the default
--    template itself.
create table if not exists meeting_planned_elements (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  element_id uuid not null references meeting_elements(id),
  sort_order integer not null,
  slot_count integer,
  created_at timestamp with time zone not null default now(),
  unique (meeting_id, element_id)
);

alter table meeting_planned_elements enable row level security;

drop policy if exists "authenticated read meeting_planned_elements" on meeting_planned_elements;
create policy "authenticated read meeting_planned_elements"
  on meeting_planned_elements for select
  to authenticated
  using (true);

drop policy if exists "authenticated write meeting_planned_elements" on meeting_planned_elements;
create policy "authenticated write meeting_planned_elements"
  on meeting_planned_elements for all
  to authenticated
  using (true)
  with check (true);
