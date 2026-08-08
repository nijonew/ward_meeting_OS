import { createClient } from "@/lib/supabase/server";

export interface RecentMusicItem {
  id: string;
  date: string;
  type: string;
  hymn_number: number | null;
  piece_name: string | null;
  performer: string | null;
  status: string;
}

export async function getRecentMusic(): Promise<RecentMusicItem[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("sacrament_music")
    .select(
      "id, type, hymn_number, piece_name, status, group_name, individual:individual_id(name), meetings!inner(date)"
    )
    .gte("meetings.date", today)
    .order("date", { foreignTable: "meetings", ascending: true })
    .limit(100);

  if (error || !data) {
    return [];
  }

  return (data as unknown[]).map((row) => {
    const r = row as {
      id: string;
      type: string;
      hymn_number: number | null;
      piece_name: string | null;
      status: string;
      group_name: string | null;
      individual: unknown;
      meetings: { date: string } | { date: string }[];
    };
    const meeting = Array.isArray(r.meetings) ? r.meetings[0] : r.meetings;
    const individual = Array.isArray(r.individual)
      ? (r.individual[0] as { name?: string } | undefined)?.name
      : (r.individual as { name?: string } | null)?.name;

    return {
      id: r.id,
      date: meeting?.date ?? "",
      type: r.type,
      hymn_number: r.hymn_number,
      piece_name: r.piece_name,
      performer: r.group_name || individual || null,
      status: r.status,
    };
  });
}