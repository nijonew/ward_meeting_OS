import { createClient } from "@/lib/supabase/server";

export interface WardEventRow {
  id: string;
  event_date: string;
  event_time: string | null;
  title: string;
  location: string | null;
  notes: string | null;
  status: string;
}

// Same pattern as getYouthActivities: RLS already limits anonymous/other
// visitors to published rows, and gives full access to any authenticated
// user. No role branching needed in the query itself.
export async function getWardEvents(): Promise<WardEventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ward_events")
    .select("id, event_date, event_time, title, location, notes, status")
    .order("event_date", { ascending: true });
  return (data ?? []) as WardEventRow[];
}