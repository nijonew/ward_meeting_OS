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
