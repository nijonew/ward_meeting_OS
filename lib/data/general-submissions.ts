import { createClient } from "@/lib/supabase/server";
import { sweepPastAnnouncements } from "@/lib/data/announcements";

export interface SubmissionRow {
  id: string;
  kind: "announcement" | "agenda_item";
  title: string;
  body: string;
  submitted_by_name: string;
  submitted_by_email: string;
  status: string;
  created_at: string;
}

export interface PublishedAnnouncement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  organization: string | null;
  announcement_type: string | null;
  audience: string | null;
  where_announced: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  location: string | null;
  link_url: string | null;
  image_url: string | null;
  recurrence: string | null;
  recurrence_day_of_week: number | null;
  recurrence_nth_occurrence: number | null;
  recurrence_day_of_month: number | null;
}

/**
 * Announcements the bishopric (or communications specialist, once that
 * role has its own submission UI) has marked "published" -- these are
 * safe to show on the public landing page with no login required.
 *
 * **No longer excludes an announcement just because it's also been
 * pulled into a meeting, 2026-11-01** (the user's own request, right
 * after noticing the old behavior firsthand: "not all of the
 * announcements are landing in the announcements page, and it seems
 * to be those that are called into other meetings. I want every
 * single announcement to remain in the announcements page even if it
 * is being announced in a meeting... selected announcements in other
 * places"). From 2026-10-11 through today, pulling an announcement
 * into a Sacrament Meeting's own Announcements block (or, for a
 * non-Sacrament meeting, it simply matching that type's own
 * `where_announced` label) removed it from this list entirely, on the
 * theory that it had been "incorporated into the program" and no
 * longer needed a separate public listing. The user's own correction:
 * this page should always show every published announcement,
 * regardless of which meeting(s) have separately pulled it in --
 * being selected into a meeting and being on the public page are two
 * independent things now, not mutually exclusive. The old
 * `sacrament_announcement_pulls`-based exclusion had exactly one
 * purpose -- this one -- so its own helper,
 * `getEverPulledAnnouncementIds` (lib/data/sacrament-announcements.ts),
 * is deleted outright rather than left unused; a specific meeting's
 * own "already pulled into THIS meeting" check (`getPullableAnnouncements`,
 * same file) is a separate, already-independent mechanism and is
 * completely unaffected by this change.
 *
 * Also runs `sweepPastAnnouncements()` first (2026-10-18) -- an
 * announcement whose own date range already ended gets archived
 * (never deleted) right before this query, same lazy-sweep-on-read
 * pattern as every other automatic cleanup in this app -- so a stale
 * announcement can't linger on the public page just because nobody
 * happened to open Manage Announcements since its date passed.
 */
export async function getPublishedAnnouncements(): Promise<PublishedAnnouncement[]> {
  await sweepPastAnnouncements();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("announcements")
    .select(
      "id, title, body, created_at, organization, announcement_type, audience, where_announced, start_date, start_time, end_date, end_time, location, link_url, image_url, recurrence, recurrence_day_of_week, recurrence_nth_occurrence, recurrence_day_of_month"
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as PublishedAnnouncement[];
}

export async function getGeneralSubmissions(): Promise<SubmissionRow[]> {
  await sweepPastAnnouncements();
  const supabase = await createClient();

  const [announcementsRes, agendaRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, submitted_by_name, submitted_by_email, status, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("agenda_items")
      .select("id, title, body, submitted_by_name, submitted_by_email, status, created_at")
      .is("meeting_id", null)
      .order("created_at", { ascending: false }),
  ]);

  const announcements = ((announcementsRes.data ?? []) as (Omit<SubmissionRow, "kind"> & { id: string })[]).map(
    (r) => ({
      ...r,
      kind: "announcement" as const,
    })
  );
  const agendaItems = ((agendaRes.data ?? []) as Omit<SubmissionRow, "kind">[]).map((r) => ({
    ...r,
    kind: "agenda_item" as const,
  }));

  return [...announcements, ...agendaItems].sort((a, b) => b.created_at.localeCompare(a.created_at));
}