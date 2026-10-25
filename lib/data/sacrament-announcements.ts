import { createClient } from "@/lib/supabase/server";
import { sweepPastAnnouncements, compareAnnouncementsBySchedule } from "@/lib/data/announcements";
import { SACRAMENT_MEETING_ANNOUNCEMENT_LABEL } from "@/lib/data/announcement-constants";

/**
 * "I want to be able to select the announcements that need to be
 * included in sacrament meeting from the list of announcements by
 * title... then I want the details of the announcement to appear in
 * the planning and conducting view" (the user's own request,
 * 2026-10-11). Builds on `announcements.meeting_id` -- a column that
 * already existed (migration 031) and was already load-bearing
 * (`getPublishedAnnouncements`/`getGeneralSubmissions` in
 * lib/data/general-submissions.ts both already excluded any row with
 * `meeting_id` set) -- but nothing had ever actually *written* it,
 * though.
 *
 * **A meeting can have more than one Announcements block, 2026-10-11**
 * (migration 074) -- `planned_element_id` is which SPECIFIC
 * `meeting_planned_elements` row (not just which meeting) an
 * announcement was pulled into.
 *
 * **Rebuilt onto a real many-to-many join table, 2026-10-15**
 * (migration 077, the user's own report: "announcements that were
 * announced in a previous meeting are now not an option to
 * announce"). The single-column `meeting_id`/`planned_element_id`
 * design meant pulling an announcement into one meeting consumed it
 * forever -- `getPullableAnnouncements` only ever offered announcements
 * with `meeting_id is null`, and once a Sacrament Meeting archives
 * (automatic, within a day or two of its own date), Planning's own
 * Remove button is gone too, so a genuinely recurring announcement
 * ("Ongoing Event"/"Future - For Planning" are real values on the
 * submission form's own `announcement_type`) had no way back into the
 * pool after its first use. New `sacrament_announcement_pulls` table
 * (`announcement_id`, `meeting_id`, `planned_element_id`, unique on
 * `(announcement_id, meeting_id)`) lets the same announcement be
 * pulled into any number of meetings at once, each one keeping its
 * own real historical record (an archived meeting's own Announcements
 * block still shows exactly what it had, regardless of whether that
 * same announcement is also sitting in a later meeting). The old
 * `announcements.meeting_id`/`planned_element_id` columns are left in
 * place, untouched, simply unused by the app from here on -- same
 * "harmless but real" treatment as `callings.title_prefix` elsewhere
 * in this app, rather than a same-day column drop.
 */
export interface PulledAnnouncement {
  id: string;
  title: string;
  body: string;
  organization: string | null;
  location: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  link_url: string | null;
  recurrence: string | null;
  recurrence_day_of_week: number | null;
  recurrence_nth_occurrence: number | null;
  recurrence_day_of_month: number | null;
}

const ANNOUNCEMENT_COLUMNS =
  "id, title, body, organization, location, start_date, start_time, end_date, end_time, link_url, recurrence, recurrence_day_of_week, recurrence_nth_occurrence, recurrence_day_of_month";

function toPulledAnnouncement(raw: unknown): PulledAnnouncement | null {
  if (!raw) return null;
  const r = Array.isArray(raw) ? raw[0] : raw;
  return (r as PulledAnnouncement) ?? null;
}

/** Every announcement id that's ever been pulled into any meeting, in
 *  any block -- what `getPublishedAnnouncements`/`getGeneralSubmissions`
 *  (lib/data/general-submissions.ts) exclude from the general public
 *  page and admin inbox: once incorporated into a Sacrament Meeting's
 *  own program, it's no longer shown as a separate, generic public
 *  announcement, regardless of how many meetings it's since been
 *  pulled into. Unlike the old single-column check, this is "ever
 *  pulled anywhere," not "currently pulled" -- an announcement doesn't
 *  come back to the general page just because it was later removed
 *  from one meeting while still sitting in another, or because it was
 *  removed from every meeting it was ever in (that case is vanishingly
 *  rare and not worth a more precise, "still pulled somewhere right
 *  now" query for). */
export async function getEverPulledAnnouncementIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("sacrament_announcement_pulls").select("announcement_id");
  return new Set((data ?? []).map((r) => (r as { announcement_id: string }).announcement_id));
}

/** Published, not yet pulled into THIS specific meeting (any of its
 *  blocks) -- what the "call in an announcement" dropdown offers.
 *  **An announcement already pulled into a DIFFERENT meeting is still
 *  offered here** (2026-10-15, see this file's own top comment) -- a
 *  recurring announcement can be read again in a later meeting
 *  without ever being removed from the one(s) it already appeared
 *  in.
 *
 *  **Sweeps expired announcements first, 2026-10-18** (the user's own
 *  follow-up right after auto-archiving shipped: "these then need to
 *  be removed from dropdown select options") -- this query reads
 *  `announcements` directly, bypassing `getAdminRows`'s own
 *  `sweepBeforeRead` hook, so without this it would keep offering an
 *  announcement whose date already passed until something else (the
 *  public page, Manage Announcements) happened to archive it first. */
export async function getPullableAnnouncements(meetingId: string): Promise<PulledAnnouncement[]> {
  await sweepPastAnnouncements();
  const supabase = await createClient();
  const [{ data: alreadyHere }, { data: announcements }] = await Promise.all([
    supabase.from("sacrament_announcement_pulls").select("announcement_id").eq("meeting_id", meetingId),
    supabase
      .from("announcements")
      .select(ANNOUNCEMENT_COLUMNS)
      .eq("status", "published")
      .order("title", { ascending: true }),
  ]);

  const excluded = new Set((alreadyHere ?? []).map((r) => (r as { announcement_id: string }).announcement_id));
  return ((announcements ?? []) as PulledAnnouncement[]).filter((a) => !excluded.has(a.id));
}

/** Already pulled into this meeting, grouped by which specific block
 *  (`meeting_planned_elements` row id) each one belongs to -- what
 *  Planning, Conducting, and the Archived view all render, one group
 *  per Announcements element actually on that meeting's agenda. */
export async function getAnnouncementsByPlannedElement(meetingId: string): Promise<Map<string, PulledAnnouncement[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sacrament_announcement_pulls")
    .select(`planned_element_id, announcements(${ANNOUNCEMENT_COLUMNS})`)
    .eq("meeting_id", meetingId);

  const result = new Map<string, PulledAnnouncement[]>();
  for (const row of (data ?? []) as { planned_element_id: string; announcements: unknown }[]) {
    const announcement = toPulledAnnouncement(row.announcements);
    if (!announcement) continue;
    const list = result.get(row.planned_element_id);
    if (list) list.push(announcement);
    else result.set(row.planned_element_id, [announcement]);
  }
  // Soonest-to-latest by event date/time, same as the public page's
  // own ordering (2026-10-25, the user's own request: "I would like
  // for the sort we discussed for announcements to also apply to the
  // order in which they appear in meetings") -- was alphabetical by
  // title, which had no relationship to when each one is actually
  // happening.
  for (const list of result.values()) list.sort(compareAnnouncementsBySchedule);
  return result;
}

/**
 * Auto-fills this one meeting's first Announcements block with every
 * published announcement flagged "Sacrament Meeting" in
 * `where_announced` whose own active window covers this meeting's
 * date -- migration 083, the user's own request: "I want items with
 * that option selected automatically landing in the Sacrament meeting
 * programs up until the time the announced item has lapsed or
 * occurred." Confirmed with the user: a recurring item should land in
 * EVERY applicable Sacrament Meeting during its window, not just the
 * nearest one -- so this is called once per Sacrament Meeting's own
 * Planning page load (same lazy-sweep-on-read pattern as
 * `autoAnnounceReadyCallingPlanningItems`), not scoped to a single
 * "nearest upcoming" meeting the way that one is.
 *
 * "In window" is a plain date-range check against `start_date`/
 * `end_date` -- deliberately NOT matched against the recurrence
 * pattern's own specific weekday/date. The recurrence fields only
 * describe which days the series itself falls on (a Tuesday class, a
 * Sunday class, whatever) -- Sacrament Meeting is always Sunday, so
 * matching the exact occurrence day would mean a non-Sunday class
 * could never be reminded about at all. The point of this auto-pull
 * is "remind the ward this is still going on," every week it's
 * active, not "this literally happens today."
 *
 * Creates a real `sacrament_announcement_pulls` row, same as a manual
 * pull -- reusable by every other reader (Planning, Conducting,
 * Archived) with no changes needed there. Skips anything already
 * pulled into this meeting, or explicitly excluded from it (an
 * admin's own Remove click -- see `sacrament_announcement_exclusions`
 * and `removeAnnouncementFromMeeting`'s own comment).
 */
export async function autoPullSacramentAnnouncements(meetingId: string, meetingDateIso: string): Promise<void> {
  const supabase = await createClient();

  const [{ data: block }, { data: candidates }, { data: alreadyHere }, { data: excluded }] = await Promise.all([
    supabase
      .from("meeting_planned_elements")
      .select("id, sort_order, meeting_elements(key)")
      .eq("meeting_id", meetingId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("announcements")
      .select("id, where_announced, start_date, end_date")
      .eq("status", "published")
      .ilike("where_announced", `%${SACRAMENT_MEETING_ANNOUNCEMENT_LABEL}%`),
    supabase.from("sacrament_announcement_pulls").select("announcement_id").eq("meeting_id", meetingId),
    supabase.from("sacrament_announcement_exclusions").select("announcement_id").eq("meeting_id", meetingId),
  ]);

  type BlockRow = { id: string; meeting_elements: { key?: string } | { key?: string }[] | null };
  const announcementsBlock = ((block ?? []) as BlockRow[]).find((row) => {
    const el = Array.isArray(row.meeting_elements) ? row.meeting_elements[0] : row.meeting_elements;
    return el?.key === "announcements";
  });
  if (!announcementsBlock) return;

  const alreadyPulled = new Set((alreadyHere ?? []).map((r) => (r as { announcement_id: string }).announcement_id));
  const excludedIds = new Set((excluded ?? []).map((r) => (r as { announcement_id: string }).announcement_id));

  const toInsert = ((candidates ?? []) as { id: string; where_announced: string | null; start_date: string | null; end_date: string | null }[])
    .filter((a) => {
      if (alreadyPulled.has(a.id) || excludedIds.has(a.id)) return false;
      // Exact-label match, not just a substring hit -- where_announced
      // is a comma-joined list (MULTI_SELECT_SEPARATOR), so the ilike
      // query above is a cheap pre-filter only; confirm the real token.
      const labels = (a.where_announced ?? "").split(",").map((s) => s.trim());
      if (!labels.includes(SACRAMENT_MEETING_ANNOUNCEMENT_LABEL)) return false;
      if (!a.start_date) return true; // no dates at all -- always active while published
      const windowEnd = a.end_date ?? a.start_date;
      return meetingDateIso >= a.start_date && meetingDateIso <= windowEnd;
    })
    .map((a) => ({ announcement_id: a.id, meeting_id: meetingId, planned_element_id: announcementsBlock.id }));

  if (toInsert.length > 0) {
    await supabase.from("sacrament_announcement_pulls").insert(toInsert);
  }
}
