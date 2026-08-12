import { createClient } from "@/lib/supabase/server";

export interface YouthActivityRow {
  id: string;
  activity_date: string;
  activity_time: string | null;
  title: string;
  group_name: string;
  location: string | null;
  development_category: string | null;
  youth_lead: string | null;
  advisor_lead: string | null;
  notes: string | null;
  status: string;
}

// No role branching needed here -- RLS on youth_activities already returns
// only published rows to anonymous/other-role requests, and everything to
// bishopric + youth leader roles. Same query works for every visitor.
export async function getYouthActivities(): Promise<YouthActivityRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("youth_activities")
    .select(
      "id, activity_date, activity_time, title, group_name, location, development_category, youth_lead, advisor_lead, notes, status"
    )
    .order("activity_date", { ascending: true });
  return (data ?? []) as YouthActivityRow[];
}