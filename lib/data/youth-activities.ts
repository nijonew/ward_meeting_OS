import { createClient } from "@/lib/supabase/server";
import { sweepMeetingCancellations } from "@/lib/data/meeting-cancellations";
import { sweepYouthActivityCancellations } from "@/lib/data/youth-activity-cancellations";
import { autoGenerateCombinedYouthActivities, fillYouthActivityPlaceholders } from "@/lib/data/youth-activity-schedule";

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
  /** UI-only, never a real column -- set only by
   *  `explodeActivitiesByClass` (lib/data/class-activities-shared.ts)
   *  on a row it drew from a shared Combined activity, naming which
   *  one. Absent (undefined) on every plain row straight from this
   *  function's own query. */
  source_group_name?: string | null;
}

// No role branching needed here -- RLS on youth_activities already returns
// only published rows to anonymous/other-role requests, and everything to
// bishopric + youth leader roles. Same query works for every visitor.
/**
 * The four lazy sweeps every reader of `youth_activities` needs run
 * first, in the right order -- shared so `getClassActivityGrid`
 * (`lib/data/class-activities.ts`, which queries this table directly
 * rather than through `getYouthActivities()` below) can trigger them
 * too, not just the pages that happen to call this function. Without
 * this, visiting a single class's own grid first -- before ever
 * loading Upcoming Activities, a Combined page, or the calendar --
 * would show that page's own "Not yet planned" blank-line fallback
 * instead of a real, saved "TBD" row.
 */
export async function runYouthActivitySweeps(): Promise<void> {
  // autoGenerateCombinedYouthActivities runs alongside the other two
  // lazy sweeps (2026-10-16, the user's own request -- see that
  // function's own comment) so the fixed Wednesday combined-week
  // rotation keeps existing automatically, the same way the other two
  // sweeps already keep cancellations in sync without anyone asking.
  await Promise.all([sweepMeetingCancellations(), sweepYouthActivityCancellations(), autoGenerateCombinedYouthActivities()]);
  // fillYouthActivityPlaceholders runs strictly AFTER the three above
  // have settled, not alongside them -- see its own comment
  // (lib/data/youth-activity-schedule.ts) for why it has to see
  // whatever they just created before deciding a class has nothing
  // covering it that week.
  await fillYouthActivityPlaceholders();
}

export async function getYouthActivities(): Promise<YouthActivityRow[]> {
  await runYouthActivitySweeps();
  const supabase = await createClient();
  const { data } = await supabase
    .from("youth_activities")
    .select(
      "id, activity_date, activity_time, title, group_name, planning_group, location, development_category, youth_lead, advisor_lead, notes, status, confirmed, cancelled, cancellation_note"
    )
    .order("activity_date", { ascending: true });
  return (data ?? []) as YouthActivityRow[];
}