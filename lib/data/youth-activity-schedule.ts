import { createClient } from "@/lib/supabase/server";
import { getMountainTimeNow } from "@/lib/data/timezone";
import { weeklyDates } from "@/lib/data/cadence";
import { ACTIVITY_CLASSES, combinedTypeForClass } from "@/lib/data/class-activities-shared";

/**
 * Generates the three combined-week youth activities (Combined YM,
 * Combined YM/YW, Combined YW) from today through a chosen date, per
 * the "Adult leaders planning youth activities" workflow in
 * PROJECT_CONTEXT.md. Deliberately separate from
 * lib/data/meeting-schedule.ts's cadence engine -- that one is tightly
 * coupled to meetings/meeting_types; this rotates plain-text youth
 * groups (youth_activity_rotations/youth_activity_rotation_members)
 * onto youth_activities rows, on an nth-Wednesday-of-month cadence that
 * has nothing to do with meetings.
 *
 * Cadence (fixed, per the user 2026-09-05 -- not read from a rules
 * table like Meeting Schedule, since there's exactly one fixed pattern
 * here, not many configurable ones): 1st Wednesday = Combined YM, 2nd
 * & 4th = Combined YW, 3rd = Combined YM/YW, 5th (when a month has one)
 * = nothing generated -- individual-group weeks aren't built yet.
 */

const ROTATION_KEYS = ["combined_ym", "combined_ym_yw", "combined_yw"] as const;
type RotationKey = (typeof ROTATION_KEYS)[number];

/** nth Wednesday of the month (1-5) -> which rotation applies, and the
 *  attendee-scope `group_name` to store (see migration 032's comment on
 *  group_name vs. planning_group). null = nothing generated. */
const NTH_WEDNESDAY_TO_ROTATION: Record<number, { key: RotationKey; groupName: string } | null> = {
  1: { key: "combined_ym", groupName: "Combined YM" },
  2: { key: "combined_yw", groupName: "Combined YW" },
  3: { key: "combined_ym_yw", groupName: "Combined YM/YW" },
  4: { key: "combined_yw", groupName: "Combined YW" },
  5: null,
};

const ROTATION_LABELS: Record<RotationKey, string> = {
  combined_ym: "Combined YM",
  combined_ym_yw: "Combined YM/YW",
  combined_yw: "Combined YW",
};

interface RotationState {
  id: string;
  nextIndex: number;
  members: string[]; // group names, in sort_order
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Every Wednesday between start and end (inclusive), tagged with which
 *  occurrence (1st..5th) of that weekday it is within its own month. */
function wednesdaysWithOccurrence(start: Date, end: Date): { date: string; nth: number }[] {
  const results: { date: string; nth: number }[] = [];
  const d = new Date(start);
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1); // 3 = Wednesday

  const occurrenceInMonth = new Map<string, number>(); // "YYYY-M" -> count so far

  while (d <= end) {
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    const nth = (occurrenceInMonth.get(monthKey) ?? 0) + 1;
    occurrenceInMonth.set(monthKey, nth);
    results.push({ date: toISODate(d), nth });
    d.setDate(d.getDate() + 7);
  }
  return results;
}

export interface GenerateYouthActivitiesResult {
  created: number;
  skippedExisting: number;
}

export async function generateCombinedYouthActivities(
  throughDateISO: string
): Promise<GenerateYouthActivitiesResult | { error: string }> {
  const supabase = await createClient();

  // Mountain Time, not the server's own UTC clock (2026-10-20 bugfix) --
  // see lib/data/meeting-schedule.ts's generateMeetingsFromRules for why.
  const today = new Date(`${getMountainTimeNow().dateIso}T00:00:00`);
  const through = new Date(`${throughDateISO}T00:00:00`);
  if (through < today) return { error: "The end date must be in the future." };

  const { data: rotationRows, error: rotationError } = await supabase
    .from("youth_activity_rotations")
    .select("id, key, next_index, youth_activity_rotation_members(group_name, sort_order)")
    .in("key", ROTATION_KEYS as unknown as string[]);

  if (rotationError) return { error: rotationError.message };

  const rotations = new Map<RotationKey, RotationState>();
  for (const row of (rotationRows ?? []) as unknown[]) {
    const r = row as {
      id: string;
      key: RotationKey;
      next_index: number;
      youth_activity_rotation_members: { group_name: string; sort_order: number }[] | null;
    };
    const members = (r.youth_activity_rotation_members ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => m.group_name);
    rotations.set(r.key, { id: r.id, nextIndex: r.next_index, members });
  }

  const missing = ROTATION_KEYS.filter((k) => !rotations.has(k) || rotations.get(k)!.members.length === 0);
  if (missing.length > 0) {
    return { error: `These rotations have no members configured yet: ${missing.join(", ")}.` };
  }

  const candidates = wednesdaysWithOccurrence(today, through);
  const candidateDates = candidates.map((c) => c.date);

  const { data: existing } = await supabase
    .from("youth_activities")
    .select("activity_date")
    .in("activity_date", candidateDates);
  const existingDates = new Set(((existing ?? []) as { activity_date: string }[]).map((r) => r.activity_date));

  let created = 0;
  let skippedExisting = 0;
  const toInsert: Record<string, unknown>[] = [];

  for (const { date, nth } of candidates) {
    const rule = NTH_WEDNESDAY_TO_ROTATION[nth];
    if (!rule) continue; // 5th Wednesday -- nothing generated

    if (existingDates.has(date)) {
      skippedExisting += 1;
      continue;
    }

    const rotation = rotations.get(rule.key)!;
    const index = rotation.nextIndex % rotation.members.length;
    const planningGroup = rotation.members[index];

    toInsert.push({
      activity_date: date,
      activity_time: "19:00",
      title: `${ROTATION_LABELS[rule.key]} Activity (TBD)`,
      group_name: rule.groupName,
      planning_group: planningGroup,
      status: "draft",
      confirmed: false,
    });

    rotation.nextIndex = (index + 1) % rotation.members.length;
    created += 1;
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from("youth_activities").insert(toInsert);
    if (insertError) return { error: insertError.message };

    for (const key of ROTATION_KEYS) {
      const rotation = rotations.get(key)!;
      await supabase.from("youth_activity_rotations").update({ next_index: rotation.nextIndex }).eq("id", rotation.id);
    }
  }

  return { created, skippedExisting };
}

/** Same rolling-horizon constant as meeting-schedule.ts's own
 *  autoGenerateUpcomingMeetings -- kept as a separate copy rather than
 *  shared, since the two engines are already deliberately independent
 *  (see this file's own top comment) and an 8-week default happens to
 *  suit both, not because they're meant to move together. */
const AUTO_GENERATE_WEEKS_AHEAD = 8;

function autoGenerateThroughDate(): string {
  const { dateIso } = getMountainTimeNow();
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + AUTO_GENERATE_WEEKS_AHEAD * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Lazy sweep, same pattern (and the same request behind it) as
 * meeting-schedule.ts's `autoGenerateUpcomingMeetings` -- run on every
 * `getYouthActivities()` call (Youth Activities' browsing pages, the
 * Manage page, etc.) so the fixed Wednesday combined-week rotation
 * just keeps existing roughly 8 weeks out, with nobody needing to
 * visit the Manage page and click "Generate Combined Activities"
 * themselves. The user's own request, 2026-10-16: "What if I didn't
 * want to ever have to generate typical activity or meeting dates...
 * Wednesday evenings are youth activity nights."
 *
 * Reuses `generateCombinedYouthActivities` exactly as the manual
 * button does -- idempotent (skips any date that already has an
 * activity) and silently does nothing if the three rotations' own
 * membership lists aren't configured yet (the same "missing
 * rotations" error the manual button would show, just swallowed here
 * rather than surfaced, since there's no one to show it to on a
 * background sweep). The manual button on the Manage page still
 * exists too, for generating further ahead or re-running directly
 * after editing rotation membership.
 */
export async function autoGenerateCombinedYouthActivities(): Promise<void> {
  try {
    await generateCombinedYouthActivities(autoGenerateThroughDate());
  } catch {
    // Swallow -- see this function's own doc comment.
  }
}

/** Separate, longer rolling horizon than the Combined-activity
 *  auto-generation above -- the user's own confirmed choice (2026-11-04,
 *  via AskUserQuestion) when this was built, kept as its own constant
 *  since the two have no reason to move together. */
const PLACEHOLDER_FILL_MONTHS_AHEAD = 3;

function placeholderFillThroughDate(): string {
  const { dateIso } = getMountainTimeNow();
  const d = new Date(`${dateIso}T00:00:00`);
  d.setMonth(d.getMonth() + PLACEHOLDER_FILL_MONTHS_AHEAD);
  return toISODate(d);
}

/**
 * "I would like to have a placeholder activity for every youth group
 * each week. It will list the group and TBD. I don't want to overwrite
 * any existing activities with this, but would like to fill the rest
 * of the table with these placeholders out as far as is reasonable"
 * (the user's own request, 2026-11-04). Confirmed via `AskUserQuestion`:
 * runs automatically, the same lazy-sweep pattern as
 * `autoGenerateCombinedYouthActivities` right above, rolling ~3 months
 * ahead rather than a one-time manual fill.
 *
 * For every Wednesday through that rolling horizon, for every one of
 * the 6 real classes (`ACTIVITY_CLASSES`) -- never touches anything
 * that already exists: a class with its own individual row, or one
 * covered by a shared Combined row (its own single-gender Combined, or
 * Combined YM/YW), is left completely alone regardless of its own
 * status/cancelled/confirmed state. Only a class with genuinely
 * nothing covering it that week gets a brand-new individual row,
 * title `"TBD"` -- so the per-class grid, the calendar (which already
 * prefixes a row's own group name onto its title, so this reads
 * "`<class>`: TBD" there), and Upcoming Activities always have
 * *something* to show instead of a blank line. Same defaults
 * (`activity_time: "19:00"`, `status: "published"`, `confirmed: false`)
 * every other individual-row insert elsewhere in this app already
 * uses for a brand-new row.
 *
 * **Must run strictly after `autoGenerateCombinedYouthActivities` and
 * `sweepYouthActivityCancellations` have both already settled**, not
 * alongside them in the same `Promise.all` (see `getYouthActivities`,
 * `lib/data/youth-activities.ts`) -- this has to see whichever Combined
 * activity (or cancellation placeholder) either of those just created
 * for a given week *before* deciding that week's classes have nothing
 * covering them, or it could stamp a redundant "TBD" row for a class
 * that's actually covered by something generated in the very same
 * sweep. That would be a real regression, not just clutter --
 * `resolveForClass` always prefers a class's own individual row over a
 * shared one, so a stray "TBD" row would silently hide the real
 * Combined activity (or the real cancellation) from that one class's
 * own view.
 */
export async function fillYouthActivityPlaceholders(): Promise<void> {
  try {
    const supabase = await createClient();
    const today = new Date(`${getMountainTimeNow().dateIso}T00:00:00`);
    const through = new Date(`${placeholderFillThroughDate()}T00:00:00`);
    const wednesdays = weeklyDates(today, through, 3);
    if (wednesdays.length === 0) return;

    const candidateGroupNames = new Set<string>(["Combined YM/YW", ...ACTIVITY_CLASSES]);
    for (const className of ACTIVITY_CLASSES) candidateGroupNames.add(combinedTypeForClass(className));

    const { data } = await supabase
      .from("youth_activities")
      .select("activity_date, group_name")
      .in("activity_date", wednesdays)
      .in("group_name", Array.from(candidateGroupNames));

    const groupsByDate = new Map<string, Set<string>>();
    for (const row of (data ?? []) as { activity_date: string; group_name: string }[]) {
      const set = groupsByDate.get(row.activity_date) ?? new Set<string>();
      set.add(row.group_name);
      groupsByDate.set(row.activity_date, set);
    }

    const toInsert: Record<string, unknown>[] = [];
    for (const date of wednesdays) {
      const groupsPresent = groupsByDate.get(date);
      for (const className of ACTIVITY_CLASSES) {
        const covered =
          groupsPresent?.has(className) ||
          groupsPresent?.has("Combined YM/YW") ||
          groupsPresent?.has(combinedTypeForClass(className));
        if (covered) continue;

        toInsert.push({
          activity_date: date,
          activity_time: "19:00",
          title: "TBD",
          group_name: className,
          status: "published",
          confirmed: false,
        });
      }
    }

    if (toInsert.length > 0) {
      await supabase.from("youth_activities").insert(toInsert);
    }
  } catch {
    // Swallow -- see this function's own doc comment.
  }
}
