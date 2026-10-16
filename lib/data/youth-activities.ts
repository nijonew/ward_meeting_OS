import { createClient } from "@/lib/supabase/server";
import { sweepMeetingCancellations } from "@/lib/data/meeting-cancellations";
import { sweepYouthActivityCancellations } from "@/lib/data/youth-activity-cancellations";
import { autoGenerateCombinedYouthActivities } from "@/lib/data/youth-activity-schedule";

export interface YouthActivityRow {
  id: string;
  activity_date: string;
  activity_time: string | null;
  title: string;
  group_name: string;
  planning_group: string | null;
  location: string | null;
  development_category: string | null;
  youth_lead: string | null;
  advisor_lead: string | null;
  notes: string | null;
  status: string;
  confirmed: boolean;
  cancelled: boolean;
  cancellation_note: string | null;
}

// No role branching needed here -- RLS on youth_activities already returns
// only published rows to anonymous/other-role requests, and everything to
// bishopric + youth leader roles. Same query works for every visitor.
export async function getYouthActivities(): Promise<YouthActivityRow[]> {
  // autoGenerateCombinedYouthActivities runs alongside the other two
  // lazy sweeps (2026-10-16, the user's own request -- see that
  // function's own comment) so the fixed Wednesday combined-week
  // rotation keeps existing automatically, the same way the other two
  // sweeps already keep cancellations in sync without anyone asking.
  await Promise.all([sweepMeetingCancellations(), sweepYouthActivityCancellations(), autoGenerateCombinedYouthActivities()]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("youth_activities")
    .select(
      "id, activity_date, activity_time, title, group_name, planning_group, location, development_category, youth_lead, advisor_lead, notes, status, confirmed, cancelled, cancellation_note"
    )
    .order("activity_date", { ascending: true });
  return (data ?? []) as YouthActivityRow[];
}