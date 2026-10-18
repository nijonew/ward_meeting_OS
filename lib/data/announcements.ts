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

function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/**
 * "Monday, October 19th" -- not the abbreviated "Mon, Oct 19" this app
 * used before 2026-10-18 (the user's own request, naming the exact
 * format wanted: "day of the week, month, date (monday, october 19th
 * at 6:00 pm)"). Shared between the public Announcements page and the
 * Conducting script's own spoken wording -- both read an announcement
 * out to someone (silently or aloud), so both wanted the same
 * reader-friendly format, not the admin grid's plain `<input
 * type="date">` editing fields, which are untouched.
 */
export function formatAnnouncementDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${weekday}, ${month} ${ordinal(d.getDate())}`;
}

/** Postgres `time` columns come back as 24-hour "HH:MM:SS" strings --
 *  rendered as plain AM/PM, same conversion this app already applied
 *  to the public Announcements page in 2026-10-10, now shared with
 *  the Conducting script too. */
export function formatAnnouncementTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mStr} ${period}`;
}

/** "Monday, October 19th at 6:00 PM" -- or a full range when the end
 *  date/time differs from the start. Used by the public Announcements
 *  listing; the Conducting script's own wording only ever reads the
 *  start date/time aloud (unchanged scope, just the new format) via
 *  `formatAnnouncementDate`/`formatAnnouncementTime` directly. */
export function formatAnnouncementDateRange(a: {
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
}): string | null {
  if (!a.start_date) return null;
  let text = formatAnnouncementDate(a.start_date);
  if (a.start_time) text += ` at ${formatAnnouncementTime(a.start_time)}`;
  if (a.end_date && a.end_date !== a.start_date) {
    text += ` – ${formatAnnouncementDate(a.end_date)}`;
    if (a.end_time) text += ` at ${formatAnnouncementTime(a.end_time)}`;
  } else if (a.end_time) {
    text += ` – ${formatAnnouncementTime(a.end_time)}`;
  }
  return text;
}
