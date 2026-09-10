-- 047_sacrament_program_templates.sql
--
-- Speakers & Music pre-fill by template (2026-09-10, the user's own
-- request): "the intent is that the templates will pre-fill the
-- speaker/music management (along with other elements) with the
-- speaker/music elements for that meeting type." Migration 046 moved
-- Speakers/Youth Speakers/Intermediate Hymn/Musical Numbers off the
-- rigid meeting_templates/slot_count mechanism entirely, onto the free
-- sacrament_program_items list -- this restores a template *default*
-- for that list, without bringing back the rigidity (a meeting still
-- freely adds/removes from its own seeded starting point).
--
-- Reconstructed from this repo's own migration history, since the real
-- slot_counts were deleted by migration 046 without being recorded
-- anywhere else: migration 033's original per-format seed data, as
-- corrected by 036 (Primary Program/Christmas/Easter deliberately
-- dropped Speaker/Youth Speaker/Intermediate Hymn) --
--   standard:           youth_speaker x2, speaker x2, intermediate_hymn x1
--   missionary_speaker:  youth_speaker x1, speaker x2, intermediate_hymn x1
--   stake_speakers:      same as standard (confirmed identical, 033)
--   baby_blessing:       same as standard (confirmed identical, 033)
--   testimony_meeting/primary_program/christmas_meeting/easter_meeting/
--     stake_conference/general_conference: none of these elements at
--     all (unchanged from before 046 -- no rows needed here).
--
-- This table only ever needs `item_key` values that match
-- lib/data/sacrament-program-shared.ts's own numbered slots
-- (`<kind>_<n>`) -- "musical_number" and "testimony" are deliberately
-- never template-seeded (never were fixed template defaults, even
-- before migration 046).
--
-- Idempotent: safe to re-run.

create table if not exists sacrament_program_templates (
  id uuid primary key default gen_random_uuid(),
  format_key text not null,
  item_key text not null,
  sort_order integer not null,
  unique (format_key, item_key)
);

alter table sacrament_program_templates enable row level security;

drop policy if exists "authenticated read sacrament_program_templates" on sacrament_program_templates;
create policy "authenticated read sacrament_program_templates"
  on sacrament_program_templates for select
  to authenticated
  using (true);

drop policy if exists "authenticated write sacrament_program_templates" on sacrament_program_templates;
create policy "authenticated write sacrament_program_templates"
  on sacrament_program_templates for all
  to authenticated
  using (true)
  with check (true);

insert into sacrament_program_templates (format_key, item_key, sort_order)
select fmt.format_key, v.item_key, v.sort_order
from (values ('standard'), ('stake_speakers'), ('baby_blessing')) as fmt(format_key)
cross join (values
  ('youth_speaker_1', 10),
  ('youth_speaker_2', 20),
  ('speaker_1', 30),
  ('speaker_2', 40),
  ('intermediate_hymn_1', 50)
) as v(item_key, sort_order)
where not exists (
  select 1 from sacrament_program_templates existing where existing.format_key = fmt.format_key
);

insert into sacrament_program_templates (format_key, item_key, sort_order)
select 'missionary_speaker', v.item_key, v.sort_order
from (values
  ('youth_speaker_1', 10),
  ('speaker_1', 20),
  ('speaker_2', 30),
  ('intermediate_hymn_1', 40)
) as v(item_key, sort_order)
where not exists (
  select 1 from sacrament_program_templates existing where existing.format_key = 'missionary_speaker'
);
