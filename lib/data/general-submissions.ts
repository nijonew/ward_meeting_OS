import { createClient } from "@/lib/supabase/server";
import { getEverPulledAnnouncementIds } from "@/lib/data/sacrament-announcements";
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
}

/**
 * Announcements the bishopric (or communications specialist, once that
 * role has its own submission UI) has marked "published" -- these are
 * safe to show on the public landing page with no login required.
 *
 * Excludes anything ever pulled into a Sacrament Meeting's own
 * Announcements block, via `getEverPulledAnnouncementIds()` -- once
 * incorporated into a meeting's own program, it's no longer shown as
 * a separate public announcement. **Switched from a stale
 * `.is("meeting_id", null)` filter to this 2026-10-15** (migration
 * 077) -- that column stopped being written once announcement pulls
 * moved to the real `sacrament_announcement_pulls` join table (see
 * that file's own header for why), so the old filter would have let
 * every pulled announcement right back onto this public page.
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

  const [pulledIds, { data, error }] = await Promise.all([
    getEverPulledAnnouncementIds(),
    supabase
      .from("announcements")
      .select(
        "id, title, body, created_at, organization, announcement_type, audience, where_announced, start_date, start_time, end_date, end_time, location, link_url"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false }),
  ]);

  if (error || !data) {
    return [];
  }

  return (data as PublishedAnnouncement[]).filter((a) => !pulledIds.has(a.id));
}

export async function getGeneralSubmissions(): Promise<SubmissionRow[]> {
  await sweepPastAnnouncements();
  const supabase = await createClient();

  const [pulledIds, announcementsRes, agendaRes] = await Promise.all([
    getEverPulledAnnouncementIds(),
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

  const announcements = ((announcementsRes.data ?? []) as (Omit<SubmissionRow, "kind"> & { id: string })[])
    .filter((r) => !pulledIds.has(r.id))
    .map((r) => ({
      ...r,
      kind: "announcement" as const,
    }));
  const agendaItems = ((agendaRes.data ?? []) as Omit<SubmissionRow, "kind">[]).map((r) => ({
    ...r,
    kind: "agenda_item" as const,
  }));

  return [...announcements, ...agendaItems].sort((a, b) => b.created_at.localeCompare(a.created_at));
}