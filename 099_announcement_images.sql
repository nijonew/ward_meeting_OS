-- 099_announcement_images.sql
--
-- Optional image attachment on announcements, with auto-delete once an
-- announcement archives -- 2026-11-01, scoped and built together with
-- the Ward Calendar View per the user's own request. Both came out of
-- the Feedback Widget's own suggestion log (Corey Anderson, 2026-10-11:
-- "upload images to support an event" / "Ward Calendar View"); this
-- migration is the announcement-images half.
--
-- Same Storage-bucket-as-a-migration pattern as 098's feedback-images
-- bucket -- public (no auth needed to read), since these are the same
-- kind of low-sensitivity attachment (a flyer/photo already meant for
-- public view on /announcements/public).
--
-- **New here, vs. 098: a real DELETE policy.** Nothing ever deleted a
-- feedback image before this, so 098 never needed one. This project
-- runs on Supabase's free plan (1 GB Storage total) -- the user's own
-- follow-up question, right after the feedback-image feature shipped,
-- was whether an announcement's own image could be cleaned up
-- automatically once the announcement itself is no longer current,
-- specifically to help stay inside that limit. The cleanup runs in two
-- places (see lib/storage/image-cleanup.ts): announcements.ts's own
-- archive-time sweep, and the generic Table Admin row-delete hook --
-- both only ever run under an authenticated session already (the
-- sweep's own status-flip UPDATE needs one to succeed in the first
-- place), so this policy is scoped to `authenticated`, matching that
-- existing requirement rather than opening deletes to `anon` too.
-- Backfilled onto feedback-images as well, now that the same generic
-- cleanup hook covers any "image"-type column, feedback's included.
--
-- Idempotent: safe to re-run.

insert into storage.buckets (id, name, public)
values ('announcement-images', 'announcement-images', true)
on conflict (id) do nothing;

drop policy if exists "authenticated can upload announcement images" on storage.objects;
create policy "authenticated can upload announcement images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'announcement-images');

drop policy if exists "public can view announcement images" on storage.objects;
create policy "public can view announcement images"
  on storage.objects for select
  to public
  using (bucket_id = 'announcement-images');

drop policy if exists "authenticated can delete announcement images" on storage.objects;
create policy "authenticated can delete announcement images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'announcement-images');

drop policy if exists "authenticated can delete feedback images" on storage.objects;
create policy "authenticated can delete feedback images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'feedback-images');

alter table announcements add column if not exists image_url text;
