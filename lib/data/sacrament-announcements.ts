import { createClient } from "@/lib/supabase/server";

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
}

const ANNOUNCEMENT_COLUMNS =
  "id, title, body, organization, location, start_date, start_time, end_date, end_time, link_url";

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
 *  in. */
export async function getPullableAnnouncements(meetingId: string): Promise<PulledAnnouncement[]> {
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
  for (const list of result.values()) list.sort((a, b) => a.title.localeCompare(b.title));
  return result;
}
