import { createClient } from "@/lib/supabase/server";

/**
 * "I want to be able to select the announcements that need to be
 * included in sacrament meeting from the list of announcements by
 * title... then I want the details of the announcement to appear in
 * the planning and conducting view" (the user's own request,
 * 2026-10-11). Builds on `announcements.meeting_id` -- a column that
 * already existed (migration 031) and was already load-bearing
 * everywhere else (`getPublishedAnnouncements`/`getGeneralSubmissions`
 * in lib/data/general-submissions.ts both already exclude any row with
 * `meeting_id` set), but nothing had ever actually set it: this is the
 * first real "pull" mechanism for it, not a new column.
 *
 * Mirrors the Ward Business pull/un-pull pattern
 * (app/meetings/[id]/ward-business-actions.ts) in spirit -- an
 * announcement is either pulled into exactly one meeting or sitting in
 * the general pool, never both -- but reuses the existing single
 * `meeting_id` FK rather than a second link table, since that's
 * already exactly what this column means everywhere else it's read.
 *
 * **A meeting can have more than one Announcements block, 2026-10-11**
 * (the user's own request: "I just want the ability to add a second
 * announcement block before the closing hymn/prayer," then, asked to
 * confirm the shape: "Two independent blocks, each its own pool").
 * `planned_element_id` (migration 074) is the new second key -- which
 * SPECIFIC `meeting_planned_elements` row (not just which meeting) an
 * announcement was pulled into, since a meeting can now have two
 * distinct Announcements rows in its own agenda, each needing its own
 * independent set of pulled items.
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
  planned_element_id: string | null;
}

const ANNOUNCEMENT_COLUMNS =
  "id, title, body, organization, location, start_date, start_time, end_date, end_time, link_url, planned_element_id";

/** Published, not yet pulled into any meeting -- what the "call in an
 *  announcement" dropdown offers, regardless of which meeting (or
 *  which of a meeting's own blocks) is asking. Once pulled into any
 *  block of any meeting, it's gone from this pool for every other
 *  block too -- matching Ward Business's own "pulled once, period"
 *  rule for Calling Planning items. */
export async function getPullableAnnouncements(): Promise<PulledAnnouncement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .is("meeting_id", null)
    .eq("status", "published")
    .order("title", { ascending: true });
  return (data ?? []) as PulledAnnouncement[];
}

/** Already pulled into this meeting, grouped by which specific block
 *  (`meeting_planned_elements` row id) each one belongs to -- what
 *  Planning, Conducting, and the Archived view all render, one group
 *  per Announcements element actually on that meeting's agenda. */
export async function getAnnouncementsByPlannedElement(meetingId: string): Promise<Map<string, PulledAnnouncement[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("meeting_id", meetingId)
    .order("title", { ascending: true });

  const result = new Map<string, PulledAnnouncement[]>();
  for (const row of (data ?? []) as PulledAnnouncement[]) {
    if (!row.planned_element_id) continue;
    const list = result.get(row.planned_element_id);
    if (list) list.push(row);
    else result.set(row.planned_element_id, [row]);
  }
  return result;
}
