-- 060_granular_features.sql
--
-- Replaces migration 057's ten `feature_*` columns (which turned out to
-- just be the old role names renamed, not real decomposed
-- capabilities -- the user's own words: "I still think features are
-- being defined by role names. I would rather define features by
-- features") with a real catalog of ~58 granular capabilities and a
-- proper many-to-many assignment, since a column-per-feature design
-- doesn't scale past a handful of flags.
--
-- New `features`: the fixed catalog (key/label/category), read-only
-- reference data -- it exists in code as the `Feature` union type in
-- lib/supabase/get-session-user.ts, and this table is just that same
-- list made queryable for display (grouping by category in the
-- assignment UI). Not meant to be edited through the app.
--
-- New `calling_features`: the actual many-to-many assignment -- which
-- calling grants which feature(s). Editable via Table Admin
-- (registered as "Calling Features", a plain two-FK mapping) for now;
-- a nicer per-calling checklist UI can replace that later if the flat
-- grid proves tedious with ~58 features times ~N callings, but this
-- reuses existing infrastructure with zero new UI code to start.
--
-- A person's access is the union of every feature granted by any
-- *active* calling they currently hold -- see
-- lib/supabase/get-session-user.ts's rewritten getSessionUser().
--
-- `callings.feature_*`, `requires_self_handoff`, and the Bishop-
-- succession trigger from migration 057 are UNCHANGED -- succession
-- protection is orthogonal to how features are catalogued, and the
-- ten old boolean columns are dropped here since they're fully
-- superseded by `calling_features`.
--
-- Idempotent: safe to re-run.

create table if not exists features (
  key text primary key,
  label text not null,
  category text not null,
  sort_order integer not null default 0
);

alter table features enable row level security;

drop policy if exists "authenticated read features" on features;
create policy "authenticated read features"
  on features for select
  to authenticated
  using (true);

-- A surrogate `id` (rather than a composite primary key on
-- (calling_id, feature_key)) because Table Admin's generic grid
-- engine assumes every table has one -- the `unique` constraint still
-- prevents granting the same feature to the same calling twice.
create table if not exists calling_features (
  id uuid primary key default gen_random_uuid(),
  calling_id uuid not null references callings(id) on delete cascade,
  feature_key text not null references features(key) on delete cascade,
  unique (calling_id, feature_key)
);

alter table calling_features enable row level security;

drop policy if exists "authenticated read calling_features" on calling_features;
create policy "authenticated read calling_features"
  on calling_features for select
  to authenticated
  using (true);

drop policy if exists "authenticated write calling_features" on calling_features;
create policy "authenticated write calling_features"
  on calling_features for all
  to authenticated
  using (true)
  with check (true);

-- Meeting-type action labels spell out the meeting type name itself
-- (e.g. "Sacrament Meeting Viewing", not just "Viewing") rather than
-- relying on the category column alone -- found while scoping the
-- Calling Features assignment UI (2026-10-04, the user's own report):
-- "Viewing"/"Planning"/etc. repeat identically across all four meeting
-- types, so a label shown without its category visibly attached
-- nearby (a flat list, a tooltip, a search result) would be
-- ambiguous. Every other feature's label already stands alone without
-- this problem (each is unique to begin with), so only these 20
-- needed the fix.
insert into features (key, label, category, sort_order) values
  -- Sacrament Meeting
  ('sacrament_viewing', 'Sacrament Meeting Viewing', 'Sacrament Meeting', 1),
  ('sacrament_planning', 'Sacrament Meeting Planning', 'Sacrament Meeting', 2),
  ('sacrament_template', 'Sacrament Meeting Template Creation', 'Sacrament Meeting', 3),
  ('sacrament_agenda_items', 'Sacrament Meeting Agenda Item Adding', 'Sacrament Meeting', 4),
  ('sacrament_notes', 'Sacrament Meeting Note Taking', 'Sacrament Meeting', 5),
  ('sacrament_music', 'Music Planning', 'Sacrament Meeting', 6),
  ('sacrament_conducting', 'Conducting Script', 'Sacrament Meeting', 7),
  ('sacrament_rabnm', 'Recognitions / Advancements / Baptisms / New Members', 'Sacrament Meeting', 8),
  ('sacrament_program_view', 'Public Program Preview (future meetings)', 'Sacrament Meeting', 9),

  -- Bishopric Meeting
  ('bishopric_meeting_viewing', 'Bishopric Meeting Viewing', 'Bishopric Meeting', 1),
  ('bishopric_meeting_planning', 'Bishopric Meeting Planning', 'Bishopric Meeting', 2),
  ('bishopric_meeting_template', 'Bishopric Meeting Template Creation', 'Bishopric Meeting', 3),
  ('bishopric_meeting_agenda_items', 'Bishopric Meeting Agenda Item Adding', 'Bishopric Meeting', 4),
  ('bishopric_meeting_notes', 'Bishopric Meeting Note Taking', 'Bishopric Meeting', 5),

  -- Ward Council
  ('ward_council_viewing', 'Ward Council Viewing', 'Ward Council', 1),
  ('ward_council_planning', 'Ward Council Planning', 'Ward Council', 2),
  ('ward_council_template', 'Ward Council Template Creation', 'Ward Council', 3),
  ('ward_council_agenda_items', 'Ward Council Agenda Item Adding', 'Ward Council', 4),
  ('ward_council_notes', 'Ward Council Note Taking', 'Ward Council', 5),

  -- Youth Council
  ('youth_council_viewing', 'Youth Council Viewing', 'Youth Council', 1),
  ('youth_council_planning', 'Youth Council Planning', 'Youth Council', 2),
  ('youth_council_template', 'Youth Council Template Creation', 'Youth Council', 3),
  ('youth_council_agenda_items', 'Youth Council Agenda Item Adding', 'Youth Council', 4),
  ('youth_council_notes', 'Youth Council Note Taking', 'Youth Council', 5),

  -- Standalone tools
  ('announcement_adding', 'Announcement Adding', 'Tools', 1),
  ('announcement_management', 'Announcement Management', 'Tools', 2),
  ('calling_planning', 'Calling Planning', 'Tools', 3),
  ('youth_teaching_planning', 'Youth Teaching Planning', 'Tools', 4),
  ('youth_activity_planning', 'Youth Activity Planning', 'Tools', 5),
  ('ward_event_planning', 'Ward Event Planning', 'Tools', 6),
  ('meeting_schedule', 'Meeting Schedule', 'Tools', 7),
  ('meeting_cancellations', 'Meeting Cancellations', 'Tools', 8),
  ('rotations', 'Assignment Rotations', 'Tools', 9),
  ('speaker_prayer_history', 'Speaker & Prayer History', 'Tools', 10),
  ('callings_roster', 'Callings Roster', 'Tools', 11),
  ('verify_logins', 'Verify Logins', 'Tools', 12),
  ('meeting_templates_admin', 'Meeting Templates (defaults)', 'Tools', 13),

  -- Table Admin, one per table
  ('table_admin_ward_settings', 'Ward Settings', 'Table Admin', 1),
  ('table_admin_admin_select_options', 'Dropdown Option Lists', 'Table Admin', 2),
  ('table_admin_hymnal_songs', 'Music Reference', 'Table Admin', 3),
  ('table_admin_agenda_items', 'Agenda Items', 'Table Admin', 4),
  ('table_admin_announcements', 'Announcements', 'Table Admin', 5),
  ('table_admin_bishopric_assignments', 'Bishopric Meeting Assignment Rotation', 'Table Admin', 6),
  ('table_admin_callings', 'Callings', 'Table Admin', 7),
  ('table_admin_council_notes', 'Council Notes', 'Table Admin', 8),
  ('table_admin_meeting_action_items', 'Meeting Action Items', 'Table Admin', 9),
  ('table_admin_meeting_element_notes', 'Meeting Element Notes', 'Table Admin', 10),
  ('table_admin_meetings', 'Meetings', 'Table Admin', 11),
  ('table_admin_people', 'People', 'Table Admin', 12),
  ('table_admin_sacrament_assignments', 'Sacrament Meeting Rotations', 'Table Admin', 13),
  ('table_admin_sacrament_music', 'Sacrament Meeting Music', 'Table Admin', 14),
  ('table_admin_sacrament_planning', 'Sacrament Meeting Planning', 'Table Admin', 15),
  ('table_admin_sacrament_rabnm', 'Recognitions / Advancements / Baptisms / New Members', 'Table Admin', 16),
  ('table_admin_sacrament_speakers_adults', 'Sacrament Meeting Speakers (Adult)', 'Table Admin', 17),
  ('table_admin_sacrament_speakers_youth', 'Sacrament Meeting Speakers (Youth)', 'Table Admin', 18),
  ('table_admin_ward_events', 'Ward Events', 'Table Admin', 19),
  ('table_admin_youth_activities', 'Youth Activities', 'Table Admin', 20),
  ('table_admin_youth_class_teachers', 'Youth Class Teachers', 'Table Admin', 21)
on conflict (key) do nothing;

alter table callings drop column if exists feature_bishopric;
alter table callings drop column if exists feature_music_planner;
alter table callings drop column if exists feature_communications_specialist;
alter table callings drop column if exists feature_ward_council;
alter table callings drop column if exists feature_youth_council;
alter table callings drop column if exists feature_yw_presidency;
alter table callings drop column if exists feature_yw_advisor;
alter table callings drop column if exists feature_yw_specialist;
alter table callings drop column if exists feature_ym_advisor;
alter table callings drop column if exists feature_ym_specialist;
