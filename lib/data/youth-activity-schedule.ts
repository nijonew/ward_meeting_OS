import { createClient } from "@/lib/supabase/server";

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
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
