import { createClient } from "@/lib/supabase/server";
import { weeklyDates, nthWeekdayDates } from "@/lib/data/cadence";
import { YOUTH_ACTIVITY_GROUPS } from "@/lib/data/youth-activity-constants";
import { YM_CLASS_NAMES, YW_CLASS_NAMES } from "@/lib/data/class-activities-shared";
import { getMountainTimeNow } from "@/lib/data/timezone";
import type { Feature } from "@/lib/supabase/get-session-user";

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
 * Which real class(es) each "Teaching Schedules" calling-feature key
 * (migration `104`, 2026-11-14) grants -- the checkbox design the user
 * asked for: "all youth, all YW, all YM, specific classes already in
 * the dropdown, relief society, elders quorum, any/all." A calling can
 * hold any combination; `getAccessibleClasses` below unions whichever
 * of these match against every feature the signed-in account's active
 * callings currently grant.
 */
export const TEACHING_SCOPE_FEATURES: { key: Feature; classes: readonly string[] }[] = [
  { key: "teaching_schedule_all", classes: ALL_TEACHING_CLASS_OPTIONS.map((c) => c.value) },
  { key: "teaching_schedule_all_youth", classes: TEACHING_CLASSES },
  { key: "teaching_schedule_all_ym", classes: YM_CLASS_NAMES },
  { key: "teaching_schedule_all_yw", classes: YW_CLASS_NAMES },
  { key: "teaching_schedule_deacons", classes: ["Deacons"] },
  { key: "teaching_schedule_teachers", classes: ["Teachers"] },
  { key: "teaching_schedule_priests", classes: ["Priests"] },
  { key: "teaching_schedule_gatherers_of_light", classes: ["Gatherers of Light"] },
  { key: "teaching_schedule_messengers_of_hope", classes: ["Messengers of Hope"] },
  { key: "teaching_schedule_builders_of_faith", classes: ["Builders of Faith"] },
  { key: "teaching_schedule_elders_quorum", classes: ["Elders Quorum"] },
  { key: "teaching_schedule_relief_society", classes: ["Relief Society"] },
];

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
  /** Second-hour class cancellations (2026-11-14) -- true only when a
   *  real row exists for this date/class with `cancelled = true`;
   *  always false for a synthesized blank or 5th-Sunday-default row
   *  (see getTeachingAssignmentGrid below). */
  cancelled: boolean;
  cancellationNote: string | null;
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
 *
 * **Gained `cancelled`/`cancellationNote`, 2026-11-14** -- driven by
 * Meeting Cancellations' new "cancel second-hour classes" option (see
 * `sweepMeetingCancellations`, lib/data/meeting-cancellations.ts).
 * Whenever a real row exists for a date, its own `cancelled` value
 * wins outright -- including over the 5th-Sunday default, since a
 * cancelled 5th Sunday shouldn't still show "Bishopric Planned."
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
    .select("class_date, teacher_name, topic, cancelled, cancellation_note")
    .in("class_date", sundays)
    .eq("class_name", teachingClass);

  const byDate = new Map<string, { teacher: string; topic: string; cancelled: boolean; cancellationNote: string | null }>();
  if (error) {
    // Most likely cause: migration 042 (which creates this table) hasn't
    // been run yet in this environment. Fail soft with an empty grid
    // rather than letting a raw Postgrest error surface as a Next.js
    // server error -- every other read in this app follows the same
    // if (error) convention (see getUpcomingMeetings, getMeetingTypes).
    console.error("getTeachingAssignmentGrid: query failed:", error.message);
  } else {
    for (const row of (data ?? []) as {
      class_date: string;
      teacher_name: string | null;
      topic: string | null;
      cancelled: boolean;
      cancellation_note: string | null;
    }[]) {
      byDate.set(row.class_date, {
        teacher: row.teacher_name ?? "",
        topic: row.topic ?? "",
        cancelled: row.cancelled,
        cancellationNote: row.cancellation_note,
      });
    }
  }

  return {
    teachingClass,
    rows: sundays.map((classDate) => {
      const saved = byDate.get(classDate);
      if (saved) return { classDate, ...saved };
      if (fifthSundays.has(classDate)) {
        return {
          classDate,
          teacher: FIFTH_SUNDAY_TEACHER,
          topic: FIFTH_SUNDAY_TOPIC,
          cancelled: false,
          cancellationNote: null,
        };
      }
      return { classDate, teacher: "", topic: "", cancelled: false, cancellationNote: null };
    }),
  };
}

/**
 * Which class(es) a signed-in account may view/edit on
 * /youth-teaching-planning -- resolves auth user -> people row (via
 * people.profile_id) -> youth_class_teachers rows -> class names. Mirrors
 * getVisibleMeetingTypesForUser's exact shape (lib/data/meeting-type-access.ts),
 * including its same optional `personId` short-circuit (2026-11-14
 * performance pass) -- pass `profile.personId` from an already-resolved
 * getSessionUser() to skip the `people` lookup below entirely.
 * Returns an empty list for an account with no matched `people` row, or
 * one with no assignments yet -- callers should treat that as "no
 * classes," not an error.
 */
export async function getTaughtClassesForUser(userId: string, personId?: string | null): Promise<string[]> {
  const supabase = await createClient();

  let resolvedPersonId: string | null;
  if (personId !== undefined) {
    resolvedPersonId = personId;
  } else {
    const { data: person } = await supabase.from("people").select("id").eq("profile_id", userId).maybeSingle();
    resolvedPersonId = person?.id ?? null;
  }
  if (!resolvedPersonId) return [];

  const { data } = await supabase.from("youth_class_teachers").select("class_name").eq("person_id", resolvedPersonId);
  return Array.from(new Set((data ?? []).map((r) => r.class_name as string)));
}

/**
 * The real access-control entry point for both Teaching Planning pages
 * (youth and adult) -- redesigned 2026-11-14 to a genuinely
 * calling-based model, the user's own request: "I want to permit
 * certain callings to enter teaching schedules... all youth, all YW,
 * all YM, specific classes already in the dropdown, relief society,
 * elders quorum, any/all. These should be checkboxes. Teachers will
 * then be plugged in by these people." A calling now grants one or
 * more of the 12 scope features above (migration `104`), assigned via
 * the existing Calling Features checklist (/admin/calling-features,
 * its own new "Teaching Schedules" category) -- no new admin page
 * needed.
 *
 * This replaces the earlier role-based bypass removed 2026-10-04 (when
 * roles were eliminated in favor of granular per-calling features) --
 * that removal left NO way for Bishopric/YW Presidency/anyone else to
 * see more than one class at a time without a tedious per-person,
 * per-class row; this is the real fix for that gap, not a reversal of
 * it.
 *
 * Unions two independent sources, same "two paths to the same access"
 * shape as getVisibleMeetingTypesForUser: (1) every class any
 * currently-held calling's scope features resolve to, and (2) the
 * pre-existing youth_class_teachers table -- left completely
 * untouched, not retired, so a specific person already assigned a
 * specific class there keeps working with zero disruption. It's now a
 * narrower, per-person exception alongside the broader calling-based
 * grants (e.g. a one-off substitute teacher), not the only mechanism.
 *
 * `features` is optional (mirrors getVisibleMeetingTypesForUser's own
 * convention) -- omitting it just skips the calling-based half and
 * falls back to youth_class_teachers alone. `personId` (optional,
 * 2026-11-14 performance pass) is threaded straight through to
 * getTaughtClassesForUser -- see that function's own comment.
 */
export async function getAccessibleClasses(
  userId: string,
  features?: Set<Feature>,
  personId?: string | null,
): Promise<string[]> {
  const fromCallings = new Set<string>();
  if (features) {
    for (const scope of TEACHING_SCOPE_FEATURES) {
      if (features.has(scope.key)) {
        for (const className of scope.classes) fromCallings.add(className);
      }
    }
  }
  const fromPersonRows = await getTaughtClassesForUser(userId, personId);
  return Array.from(new Set([...fromCallings, ...fromPersonRows]));
}
