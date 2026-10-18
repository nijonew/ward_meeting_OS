import { createClient } from "@/lib/supabase/server";
import { getMountainTimeNow } from "@/lib/data/timezone";

/**
 * Archives any "published" announcement whose own date range has
 * ended -- lazy sweep on read (2026-10-18, the user's own question:
 * "can this automatically archive or delete announcements whose time
 * has passed?"), same pattern as every other automatic cleanup in
 * this app (`autoArchivePastMeetings`, `sweepMeetingCancellations`,
 * `autoGenerateUpcomingMeetings`) -- run on the way in, not on a
 * schedule, since this app has no cron infrastructure.
 *
 * "Time has passed" means `end_date`, or `start_date` when there's no
 * `end_date`, is strictly before today (Mountain Time -- matches
 * `isSacramentMeetingPubliclyVisible`'s own reasoning, since this
 * also governs when something disappears from a genuinely public
 * page, not an admin-only filter where a UTC day boundary wouldn't
 * much matter). Many real announcements legitimately have neither
 * date set (General Information, a standing Lesson note, etc.) --
 * those have nothing to compare against and are never touched.
 *
 * **Archives, never deletes** -- matches this app's own consistent
 * "shown, not destroyed" convention for every other automatic sweep
 * (Cancel, not Delete, for a meeting or activity; Archive, not
 * Delete, here). An admin can still delete one by hand from Manage
 * Announcements or Table Admin if they actually want it gone for
 * good; this sweep only ever moves a `published` row to `archived`
 * (already the exact status that excludes it from the public page
 * and the admin inbox's live list) -- a `pending` row that was never
 * reviewed, or one already `archived`, is left alone, so this can
 * never surface something that was never published or re-touch a
 * status an admin already set deliberately.
 */
export async function sweepPastAnnouncements(): Promise<void> {
  const supabase = await createClient();
  const { dateIso: today } = getMountainTimeNow();

  await supabase
    .from("announcements")
    .update({ status: "archived" })
    .eq("status", "published")
    .or(`end_date.lt.${today},and(end_date.is.null,start_date.lt.${today})`);
}
