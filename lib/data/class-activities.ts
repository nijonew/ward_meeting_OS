import { createClient } from "@/lib/supabase/server";
import { weeklyDates } from "@/lib/data/cadence";
import { YOUTH_ACTIVITY_GROUPS } from "@/lib/data/youth-activity-constants";

/** The 6 real classes/quorums -- excludes the "Combined ..." pseudo-
 *  values, which describe attendee scope, not an actual class. Same
 *  derivation as TEACHING_CLASSES (lib/data/teaching-assignments.ts),
 *  kept separate rather than imported from there since that module is
 *  about the Teaching domain specifically, not a general "list of real
 *  classes" utility. */
export const ACTIVITY_CLASSES = YOUTH_ACTIVITY_GROUPS.filter((g) => !g.value.startsWith("Combined")).map((g) => g.value);

const YM_CLASSES = new Set(["Deacons", "Teachers", "Priests"]);

/** Which single-gender combined type a class belongs to -- every class
 *  also belongs to "Combined YM/YW" (everyone), checked separately. */
function combinedTypeForClass(className: string): string {
  return YM_CLASSES.has(className) ? "Combined YM" : "Combined YW";
}

export interface ClassActivityRow {
  activityDate: string;
  /** The youth_activities.group_name this row actually saves to --
   *  the class's own name for an individual week, or whichever
   *  Combined type it's drawn from. Encoded into the grid's own field
   *  names (not itself an editable value) so a save updates the real
   *  shared row rather than forking a class-specific copy. */
  sourceGroupName: string;
  activityId: string | null;
  isCombined: boolean;
  title: string;
  location: string;
  developmentCategory: string;
  planningGroup: string;
}

function blankRow(activityDate: string, className: string): ClassActivityRow {
  return {
    activityDate,
    sourceGroupName: className,
    activityId: null,
    isCombined: false,
    title: "",
    location: "",
    developmentCategory: "",
    planningGroup: "",
  };
}

/**
 * One row per upcoming Wednesday between today and throughDateISO for a
 * single class -- drawing from whichever youth_activities row actually
 * applies to that date for this class: its own individual activity if
 * one exists, else the shared Combined row it attends that week (its
 * own single-gender Combined type first, then Combined YM/YW), else a
 * blank line to fill in. Every line is editable regardless of source
 * (2026-10-11, the user's own request: "all lines should ultimately be
 * editable even if they are prefilled by a combined activity table") --
 * editing a Combined-sourced line updates that same shared row, visible
 * to every other class that attends it too, since it really is one
 * event, not a per-class copy of it.
 */
export async function getClassActivityGrid(className: string, throughDateISO: string): Promise<ClassActivityRow[]> {
  const today = new Date();
  const through = new Date(`${throughDateISO}T00:00:00`);
  const wednesdays = weeklyDates(today, through, 3);

  if (wednesdays.length === 0) return [];

  const combinedType = combinedTypeForClass(className);
  const candidateGroups = [className, combinedType, "Combined YM/YW"];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("youth_activities")
    .select("id, activity_date, group_name, title, location, development_category, planning_group")
    .in("activity_date", wednesdays)
    .in("group_name", candidateGroups);

  if (error) {
    console.error("getClassActivityGrid: query failed:", error.message);
    return wednesdays.map((d) => blankRow(d, className));
  }

  type RawRow = {
    id: string;
    activity_date: string;
    group_name: string;
    title: string | null;
    location: string | null;
    development_category: string | null;
    planning_group: string | null;
  };

  const byDate = new Map<string, Map<string, RawRow>>();
  for (const row of (data ?? []) as RawRow[]) {
    const byGroup = byDate.get(row.activity_date) ?? new Map<string, RawRow>();
    byGroup.set(row.group_name, row);
    byDate.set(row.activity_date, byGroup);
  }

  return wednesdays.map((activityDate) => {
    const byGroup = byDate.get(activityDate);
    const match = byGroup?.get(className) ?? byGroup?.get(combinedType) ?? byGroup?.get("Combined YM/YW") ?? null;
    if (!match) return blankRow(activityDate, className);
    return {
      activityDate,
      sourceGroupName: match.group_name,
      activityId: match.id,
      isCombined: match.group_name !== className,
      title: match.title ?? "",
      location: match.location ?? "",
      developmentCategory: match.development_category ?? "",
      planningGroup: match.planning_group ?? "",
    };
  });
}
