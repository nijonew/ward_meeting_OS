import { createClient } from "@/lib/supabase/server";

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
}

/**
 * Announcements the bishopric (or communications specialist, once that
 * role has its own submission UI) has marked "published" -- these are
 * safe to show on the public landing page with no login required.
 */
export async function getPublishedAnnouncements(): Promise<PublishedAnnouncement[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, created_at")
    .is("meeting_id", null)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as PublishedAnnouncement[];
}

export async function getGeneralSubmissions(): Promise<SubmissionRow[]> {
  const supabase = await createClient();

  const [announcementsRes, agendaRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, submitted_by_name, submitted_by_email, status, created_at")
      .is("meeting_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("agenda_items")
      .select("id, title, body, submitted_by_name, submitted_by_email, status, created_at")
      .is("meeting_id", null)
      .order("created_at", { ascending: false }),
  ]);

  const announcements = ((announcementsRes.data ?? []) as Omit<SubmissionRow, "kind">[]).map((r) => ({
    ...r,
    kind: "announcement" as const,
  }));
  const agendaItems = ((agendaRes.data ?? []) as Omit<SubmissionRow, "kind">[]).map((r) => ({
    ...r,
    kind: "agenda_item" as const,
  }));

  return [...announcements, ...agendaItems].sort((a, b) => b.created_at.localeCompare(a.created_at));
}