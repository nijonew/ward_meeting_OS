-- 044_calling_planning_candidates_multiselect.sql
--
-- Per the user (2026-09-08), right after migration 043 shipped: drop
-- the free-text Candidates field and instead let "Selected Person"
-- become the candidates field, with multi-select so several people can
-- be under consideration at once. Replaces both `candidates_text`
-- (043) and the single-value `selected_person_id` with one
-- `candidate_person_ids uuid[]` column -- a real people reference
-- (unlike the free-text version), multi-valued (unlike the old
-- single-select). Once narrowed down to exactly one person, that's
-- what `pushCallingToSacramentMeeting` treats as "the selected person"
-- for the Sacrament Meeting announcement integration.
--
-- Idempotent: safe to re-run. If dropping selected_person_id ever hits
-- an undocumented dependency (an anon RLS policy, etc.) the way
-- migration 041 did for sacrament_assignments.confirmed, report the
-- exact error back -- same fix pattern applies (drop the dependent
-- object by name first).

alter table calling_planning add column if not exists candidate_person_ids uuid[] not null default '{}';
alter table calling_planning drop column if exists candidates_text;
alter table calling_planning drop column if exists selected_person_id;
