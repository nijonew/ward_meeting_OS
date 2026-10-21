import { createClient } from "@/lib/supabase/server";
import { weeklyDates } from "@/lib/data/cadence";
import { combinedTypeForClass, resolveForClass } from "@/lib/data/class-activities-shared";
import { getMountainTimeNow } from "@/lib/data/timezone";

export { ACTIVITY_CLASSES, classesForCombinedGroup } from "@/lib/data/class-activities-shared";

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
  confirmed: boolean;
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
    confirmed: false,
  };
}

/**
 * One row per upcoming Wednesday between today and throughDateISO for a
 * single class -- drawing from whichever youth_activities row actually
 * applies to that date for this class: its own individual activity if
 * one exists, else the shared Combined row it attends that week (see
 * resolveForClass's own comment for the exact precedence between
 * Combined YM/YW and this class's single-gender Combined type), else a
 * blank line to fill in. Every line is editable regardless of source
 * (2026-10-11, the user's own request: "all lines should ultimately be
 * editable even if they are prefilled by a combined activity table") --
 * editing a Combined-sourced line updates that same shared row, visible
 * to every other class that attends it too, since it really is one
 * event, not a per-class copy of it.
 */
export async function getClassActivityGrid(className: string, throughDateISO: string): Promise<ClassActivityRow[]> {
  // Mountain Time, not the server's own UTC clock (2026-10-20 bugfix) --
  // see lib/data/meetings.ts's autoArchivePastMeetings for why.
  const today = new Date(`${getMountainTimeNow().dateIso}T00:00:00`);
  const through = new Date(`${throughDateISO}T00:00:00`);
  const wednesdays = weeklyDates(today, through, 3);

  if (wednesdays.length === 0) return [];

  const candidateGroups = [className, combinedTypeForClass(className), "Combined YM/YW"];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("youth_activities")
    .select("id, activity_date, group_name, title, location, development_category, planning_group, confirmed")
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
    confirmed: boolean;
  };

  const byDate = new Map<string, Map<string, RawRow>>();
  for (const row of (data ?? []) as RawRow[]) {
    const byGroup = byDate.get(row.activity_date) ?? new Map<string, RawRow>();
    byGroup.set(row.group_name, row);
    byDate.set(row.activity_date, byGroup);
  }

  return wednesdays.map((activityDate) => {
    const match = resolveForClass(byDate.get(activityDate), className);
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
      confirmed: match.confirmed,
    };
  });
}
