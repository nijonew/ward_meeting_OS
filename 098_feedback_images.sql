-- 098_feedback_images.sql
--
-- Screenshot/image upload on the persistent Feedback Widget,
-- 2026-11-01 -- Corey Anderson and Jeremy Hardman both independently
-- asked for this the same day (2026-10-11), through the widget itself:
-- "Upload screen shots in help field to show issue" / "Add ability to
-- upload images for bug fix to be able to show what the problem is."
--
-- This app has never used Supabase Storage before -- a bucket is just
-- a row in storage.buckets, so it's created here the same way every
-- other piece of this schema is: a plain SQL migration, no dashboard
-- step needed. Public (readable with no auth, via Storage's own
-- public CDN-style URL) rather than private/signed-URL -- these are
-- low-sensitivity bug-report screenshots, not anything needing the
-- extra complexity of generating/expiring signed URLs. The real access
-- boundary that matters -- who can see the feedback ROW itself, with
-- its page/body/submitter -- is already the `table_admin_feedback`
-- feature gate on /admin/feedback, completely unaffected by this; a
-- public image URL only reveals the screenshot itself to someone who
-- already has the exact, randomly-generated file name.
--
-- Idempotent: safe to re-run.

insert into storage.buckets (id, name, public)
values ('feedback-images', 'feedback-images', true)
on conflict (id) do nothing;

drop policy if exists "authenticated can upload feedback images" on storage.objects;
create policy "authenticated can upload feedback images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'feedback-images');

drop policy if exists "public can view feedback images" on storage.objects;
create policy "public can view feedback images"
  on storage.objects for select
  to public
  using (bucket_id = 'feedback-images');

alter table feedback add column if not exists image_url text;
