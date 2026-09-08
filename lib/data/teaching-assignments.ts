import { createClient } from "@/lib/supabase/server";
import { weeklyDates } from "@/lib/data/cadence";
import { YOUTH_ACTIVITY_GROUPS } from "@/lib/data/youth-activity-constants";

/**
 * The 6 real YM/YW classes -- excludes the "Combined ..." pseudo-values
 * in YOUTH_ACTIVITY_GROUPS, which describe attendee scope for a combined
 * activity, not an actual class with its own Sunday lesson. Derived
 * rather than duplicated so a future class rename (like the mid-2026 YW
 * rename) only has to happen in one place.
 */
export const TEACHING_CLASSES = YOUTH_ACTIVITY_GROUPS.filter((g) => !g.value.startsWith("Combined")).map(
  (g) => g.value
);

export interface TeachingGridRow {
  classDate: string;
  cells: Record<string, string>; // class name -> entry text (missing/empty = nothing entered)
}

export interface TeachingGrid {
  classes: string[];
  rows: TeachingGridRow[];
}

/**
 * One row per upcoming Sunday between today and throughDateISO, whether
 * or not a teaching_assignments row exists yet for it -- same "always
 * show every date, fill in what's real" approach as the Assignment
 * Rotations grid (getAssignmentGrid in lib/data/rotations.ts), just
 * keyed on the calendar's own Sundays instead of scheduled meetings
 * (every Sunday exists whether or not anything else is planned for it).
 */
export async function getTeachingAssignmentGrid(throughDateISO: string): Promise<TeachingGrid> {
  const today = new Date();
  const through = new Date(`${throughDateISO}T00:00:00`);
  const sundays = weeklyDates(today, through, 0);

  if (sundays.length === 0) {
    return { classes: TEACHING_CLASSES, rows: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teaching_assignments")
    .select("class_date, class_name, entry")
    .in("class_date", sundays);

  if (error) {
    // Most likely cause: migration 042 (which creates this table) hasn't
    // been run yet in this environment. Fail soft with an empty grid
    // rather than letting a raw Postgrest error surface as a Next.js
    // server error -- every other read in this app follows the same
    // if (error) convention (see getUpcomingMeetings, getMeetingTypes).
    console.error("getTeachingAssignmentGrid: query failed:", error.message);
    return { classes: TEACHING_CLASSES, rows: sundays.map((classDate) => ({ classDate, cells: {} })) };
  }

  const byDate = new Map<string, Record<string, string>>();
  for (const row of (data ?? []) as { class_date: string; class_name: string; entry: string }[]) {
    const cells = byDate.get(row.class_date) ?? {};
    cells[row.class_name] = row.entry;
    byDate.set(row.class_date, cells);
  }

  return {
    classes: TEACHING_CLASSES,
    rows: sundays.map((classDate) => ({ classDate, cells: byDate.get(classDate) ?? {} })),
  };
}
