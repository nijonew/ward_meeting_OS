import { createClient } from "@/lib/supabase/server";
import { weeklyDates } from "@/lib/data/cadence";
import { YOUTH_ACTIVITY_GROUPS } from "@/lib/data/youth-activity-constants";
import type { AppRole } from "@/lib/supabase/get-session-user";

/**
 * The 6 real YM/YW classes -- excludes the "Combined ..." pseudo-values
 * in YOUTH_ACTIVITY_GROUPS, which describe attendee scope for a combined
 * activity, not an actual class with its own Sunday lesson. Derived
 * rather than duplicated so a future class rename (like the mid-2026 YW
 * rename) only has to happen in one place.
 */
export const TEACHING_CLASS_OPTIONS = YOUTH_ACTIVITY_GROUPS.filter((g) => !g.value.startsWith("Combined"));
export const TEACHING_CLASSES = TEACHING_CLASS_OPTIONS.map((g) => g.value);

/** The 3 YW classes, out of TEACHING_CLASSES -- Young Women Presidency
 *  sees every one of these regardless of any youth_class_teachers row
 *  (see getAccessibleClasses), per the user's own words: "young women
 *  presidency can see all young women groups." Kept as an explicit list
 *  rather than a name-based filter (e.g. "doesn't start with Deacons/
 *  Teachers/Priests") so a future class rename can't silently misclassify
 *  one. */
export const YW_CLASSES = ["Gatherers of Light", "Messengers of Hope", "Builders of Faith"];

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
 *
 * `classes` narrows both the query and the returned grid to a specific
 * subset -- added 2026-09-09 so a single class's own page
 * (/youth-teaching-planning?class=<name>) can render just that one
 * column instead of every class at once. Defaults to every class, the
 * original all-in-one-grid behavior.
 */
export async function getTeachingAssignmentGrid(throughDateISO: string, classes: string[] = TEACHING_CLASSES): Promise<TeachingGrid> {
  const today = new Date();
  const through = new Date(`${throughDateISO}T00:00:00`);
  const sundays = weeklyDates(today, through, 0);

  if (sundays.length === 0 || classes.length === 0) {
    return { classes, rows: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teaching_assignments")
    .select("class_date, class_name, entry")
    .in("class_date", sundays)
    .in("class_name", classes);

  if (error) {
    // Most likely cause: migration 042 (which creates this table) hasn't
    // been run yet in this environment. Fail soft with an empty grid
    // rather than letting a raw Postgrest error surface as a Next.js
    // server error -- every other read in this app follows the same
    // if (error) convention (see getUpcomingMeetings, getMeetingTypes).
    console.error("getTeachingAssignmentGrid: query failed:", error.message);
    return { classes, rows: sundays.map((classDate) => ({ classDate, cells: {} })) };
  }

  const byDate = new Map<string, Record<string, string>>();
  for (const row of (data ?? []) as { class_date: string; class_name: string; entry: string }[]) {
    const cells = byDate.get(row.class_date) ?? {};
    cells[row.class_name] = row.entry;
    byDate.set(row.class_date, cells);
  }

  return {
    classes,
    rows: sundays.map((classDate) => ({ classDate, cells: byDate.get(classDate) ?? {} })),
  };
}

/**
 * Which class(es) a signed-in account may view/edit on
 * /youth-teaching-planning -- resolves auth user -> people row (via
 * people.profile_id) -> youth_class_teachers rows -> class names. Mirrors
 * getVisibleMeetingTypesForUser's exact shape (lib/data/meeting-type-access.ts).
 * Returns an empty list for an account with no matched `people` row, or
 * one with no assignments yet -- callers should treat that as "no
 * classes," not an error.
 */
export async function getTaughtClassesForUser(userId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data: person } = await supabase.from("people").select("id").eq("profile_id", userId).maybeSingle();
  if (!person) return [];

  const { data } = await supabase.from("youth_class_teachers").select("class_name").eq("person_id", person.id);
  return Array.from(new Set((data ?? []).map((r) => r.class_name as string)));
}

/**
 * The real access-control entry point for Youth Teaching Planning
 * (2026-09-09, the user's own request): "authenticate the specific
 * people assigned to the youth group to see only their group unless it
 * is the bishopric or young women presidency. Bishopric can see all
 * groups. young women presidency can see all young women groups."
 * Bishopric and Young Women Presidency stay role-based (every class /
 * every YW class, respectively, regardless of any youth_class_teachers
 * row); everyone else -- including the other 4 youth-leader roles,
 * which used to get blanket access to the whole calendar -- is narrowed
 * down to exactly the class(es) they're specifically assigned to teach.
 */
export async function getAccessibleClasses(userId: string, role: AppRole | null): Promise<string[]> {
  if (role === "bishopric") return TEACHING_CLASSES;
  if (role === "yw_presidency") return YW_CLASSES;
  return getTaughtClassesForUser(userId);
}
