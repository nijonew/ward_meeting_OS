-- 108_feature_catalog_anon_read.sql
--
-- Bug found 2026-11-15: /admin/calling-features showed no features at
-- all for anyone, after migration 104 (already run) added the new
-- "Teaching Schedules" category -- the user's own report: "the
-- features list doesn't show up." Confirmed run again with no
-- improvement, which ruled out a missing-migration explanation and
-- pointed straight at the read path instead.
--
-- Root cause: the 2026-11-14 pre-launch performance pass
-- (lib/data/calling-features.ts's `getFeatureCatalogByCategory`, and
-- lib/data/select-options.ts's `getSelectOptions` right alongside it)
-- wrapped both reads in `unstable_cache`, which can't call anything
-- that reads cookies()/headers() -- so both switched from this app's
-- usual cookie-aware client to `createCacheableClient()`
-- (lib/supabase/cacheable-client.ts), a plain anon-key client with no
-- session attached at all. That function's own doc comment says this
-- is "correct here because every table this is used against already
-- has its own anon-facing RLS policy" -- true for its original two
-- callers (`hymnal_songs`/`ward_settings`), but `features` and
-- `admin_select_options` were never checked before being added as a
-- third and fourth caller: both have only ever had a `to authenticated`
-- SELECT policy (migrations 060/022), never an `anon` one. A session-
-- less client is the `anon` Postgres role regardless of which API key
-- it's constructed with, so RLS silently returned zero rows for
-- `features` -- not an error, just an empty catalog, which is exactly
-- "the features list doesn't show up." `admin_select_options` has the
-- identical gap, but it's been masked this whole time by
-- `getSelectOptions`'s own `fallback` parameter quietly substituting
-- the hardcoded default option list whenever the real query comes back
-- empty -- meaning any admin customization made through
-- /admin/admin_select_options has likely been silently ignored since
-- that same performance pass shipped, with nothing on screen ever
-- showing it.
--
-- Fix: add a narrow `anon` read policy to both tables, matching the
-- exact precedent already set for `hymnal_songs`/`ward_settings` (both
-- low-sensitivity reference/catalog tables, not real ward data) --
-- `features` holds nothing but a fixed key/label/category catalog,
-- and `admin_select_options` nothing but dropdown value/label lists;
-- neither has ever held anything about a real person. This keeps the
-- performance pass's own cross-request caching intact rather than
-- reverting it, and is consistent with this app's own documented RLS
-- philosophy (architecture.md section 10) of narrow, read-only anon
-- policies scoped to exactly what's already safe to read.
--
-- Idempotent: safe to re-run.

drop policy if exists "public read features" on features;
create policy "public read features"
  on features for select
  to anon
  using (true);

drop policy if exists "public read admin_select_options" on admin_select_options;
create policy "public read admin_select_options"
  on admin_select_options for select
  to anon
  using (true);
