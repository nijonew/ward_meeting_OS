import { createClient } from "@/lib/supabase/server";
import { weeklyDates, nthWeekdayDates } from "@/lib/data/cadence";
import { YOUTH_ACTIVITY_GROUPS } from "@/lib/data/youth-activity-constants";
import { getMountainTimeNow } from "@/lib/data/timezone";

/**
 * The 6 real YM/YW classes -- excludes the "Combined ..." pseudo-values
 * in YOUTH_ACTIVITY_GROUPS, which describe attendee scope for a combined
 * activity, not an actual class with its own Sunday lesson. Derived
 * rather than duplicated so a future class rename (like the mid-2026 YW
 * rename) only has to happen in one place.
 */
export const TEACHING_CLASS_OPTIONS = YOUTH_ACTIVITY_GROUPS.filter((g) => !g.value.startsWith("Combined"));
export const TEACHING_CLASSES = TEACHING_CLASS_OPTIONS.map((g) => g.value);

/**
 * The two adult organizations with their own Sunday teaching slot --
 * added 2026-11-05 alongside the Teacher/Topic rework, reusing the
 * exact same `teaching_assignments` table and mechanism as the 6 youth
 * classes above. Just two more `class_name` values on one shared table,
 * rendered on their own page (/adult-teaching-planning, side by side)
 * rather than Youth Teaching Planning's per-class hub -- there's no
 * open-ended roster of adult classes the way there is youth classes, so
 * no per-person access-control table is needed for these two; the page
 * itself is gated by the `adult_teaching_planning` feature alone.
 */
export const ADULT_TEACHING_CLASS_OPTIONS = [
  { value: "Elders Quorum", label: "Elders Quorum" },
  { value: "Relief Society", label: "Relief Society" },
];
export const ADULT_TEACHING_CLASSES = ADULT_TEACHING_CLASS_OPTIONS.map((g) => g.value);

/** Every real `teaching_assignments.class_name` value, youth and adult
 *  combined -- the one list Table Admin's raw fallback grid needs so
 *  its Class dropdown covers every row this table can actually hold. */
export const ALL_TEACHING_CLASS_OPTIONS = [...TEACHING_CLASS_OPTIONS, ...ADULT_TEACHING_CLASS_OPTIONS];

/**
 * A 5th Sunday's own default Teacher/Topic -- the standard Church
 * convention of a Bishopric-directed combined lesson on a month's rare
 * extra Sunday, rather than each organization's regular lesson. Shown
 * only as a row's pre-filled default when nothing has been saved for
 * that date yet (see getTeachingAssignmentGrid) -- never written to the
 * database on its own, so it's freely overwritable before anyone saves,
 * per the user's own request, and never silently creates a row nobody
 * asked for.
 */
export const FIFTH_SUNDAY_TEACHER = "Bishopric Planned";
export const FIFTH_SUNDAY_TOPIC = "5th Sunday";

export interface TeachingGridRow {
  classDate: string;
  teacher: string;
  topic: string;
}

export interface TeachingGrid {
  teachingClass: string;
  rows: TeachingGridRow[];
}

/**
 * One row per upcoming Sunday between today and throughDateISO for a
 * single class, whether or not a teaching_assignments row exists yet
 * for it -- same "always show every date, fill in what's real" approach
 * as the Assignment Rotations grid (getAssignmentGrid in
 * lib/data/rotations.ts), just keyed on the calendar's own Sundays
 * instead of scheduled meetings (every Sunday exists whether or not
 * anything else is planned for it).
 *
 * **Reworked 2026-11-05** from a multi-class grid (one column per
 * class) into a single-class, two-field grid (Teacher + Topic columns
 * for one class) -- every real caller already narrowed to exactly one
 * class, so this is a simplification, not a capability loss. A Sunday
 * that's the 5th occurrence of its month (via the same nthWeekdayDates
 * this app's cadence-rule engines already use) defaults its two fields
 * to FIFTH_SUNDAY_TEACHER/FIFTH_SUNDAY_TOPIC whenever no real row has
 * been saved for it yet.
 */
export async function getTeachingAssignmentGrid(throughDateISO: string, teachingClass: string): Promise<TeachingGrid> {
  // Mountain Time, not the server's own UTC clock (2026-10-20 bugfix) --
  // see lib/data/meetings.ts's autoArchivePastMeetings for why.
  const today = new Date(`${getMountainTimeNow().dateIso}T00:00:00`);
  const through = new Date(`${throughDateISO}T00:00:00`);
  const sundays = weeklyDates(today, through, 0);

  if (sundays.length === 0) {
    return { teachingClass, rows: [] };
  }

  const fifthSundays = new Set(nthWeekdayDates(today, through, 0, 5));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teaching_assignments")
    .select("class_date, teacher_name, topic")
    .in("class_date", sundays)
    .eq("class_name", teachingClass);

  const byDate = new Map<string, { teacher: string; topic: string }>();
  if (error) {
    // Most likely cause: migration 042 (which creates this table) hasn't
    // been run yet in this environment. Fail soft with an empty grid
    // rather than letting a raw Postgrest error surface as a Next.js
    // server error -- every other read in this app follows the same
    // if (error) convention (see getUpcomingMeetings, getMeetingTypes).
    console.error("getTeachingAssignmentGrid: query failed:", error.message);
  } else {
    for (const row of (data ?? []) as { class_date: string; teacher_name: string | null; topic: string | null }[]) {
      byDate.set(row.class_date, { teacher: row.teacher_name ?? "", topic: row.topic ?? "" });
    }
  }

  return {
    teachingClass,
    rows: sundays.map((classDate) => {
      const saved = byDate.get(classDate);
      if (saved) return { classDate, ...saved };
      if (fifthSundays.has(classDate)) {
        return { classDate, teacher: FIFTH_SUNDAY_TEACHER, topic: FIFTH_SUNDAY_TOPIC };
      }
      return { classDate, teacher: "", topic: "" };
    }),
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
 * The real access-control entry point for Youth Teaching Planning.
 * Originally (2026-09-09) Bishopric and Young Women Presidency got a
 * role-based bypass straight to every class / every YW class
 * respectively, with no youth_class_teachers row needed. That bypass
 * had nowhere to attach once roles were eliminated in favor of
 * granular per-calling features (2026-10-04) -- the user's own call,
 * when asked, was to drop it rather than hardcode a calling-name
 * substitute: every class anyone should see, Bishopric and YW
 * Presidency included, now needs a real youth_class_teachers row, the
 * exact same mechanism every other class-specific teacher already
 * uses. Seed those rows once (directly in Supabase or Table Admin) for
 * whoever should see every class or every YW class.
 */
export async function getAccessibleClasses(userId: string): Promise<string[]> {
  return getTaughtClassesForUser(userId);
}
