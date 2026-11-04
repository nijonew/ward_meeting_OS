import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_CLASSES, classesForCombinedGroup, combinedTypeForClass } from "@/lib/data/class-activities-shared";
import { weeklyDates } from "@/lib/data/cadence";

/** Cancellation holds no extra information at all, 2026-11-04 (the
 *  user's own rule: "no additional information needed for the week
 *  other than it is cancelled") -- a placeholder row only ever exists
 *  to carry this title + cancelled=true + the cancellation's own
 *  reason; the "Cancelled" badge next to it already says the rest. */
const CANCELLED_PLACEHOLDER_TITLE = "(No activity)";

export interface YouthActivityCancellationRow {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  group_names: string[];
}

export async function getYouthActivityCancellations(): Promise<YouthActivityCancellationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("youth_activity_cancellations")
    .select("id, start_date, end_date, reason, group_names")
    .order("start_date", { ascending: false });
  return (data ?? []) as YouthActivityCancellationRow[];
}

type ActionResult = { success: true } | { error: string };

export async function addYouthActivityCancellation(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const groupNames = formData.getAll("group_names").map(String);

  if (!startDate || !endDate || !reason) {
    return { error: "Date range and a reason are required." };
  }
  if (endDate < startDate) {
    return { error: "End date can't be before start date." };
  }

  const { error } = await supabase.from("youth_activity_cancellations").insert({
    start_date: startDate,
    end_date: endDate,
    reason,
    group_names: groupNames,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteYouthActivityCancellation(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("youth_activity_cancellations").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

type RawActivityRow = { id: string; activity_date: string; group_name: string; cancelled: boolean };

/**
 * Lazy sweep, same pattern as sweepMeetingCancellations -- runs on every
 * read of youth_activities (getYouthActivities) rather than once when a
 * cancellation is saved, so an activity added after a cancellation was
 * entered still gets caught. Only ever ADDS a cancellation -- never
 * auto-reverses one a row already has.
 *
 * `group_names` empty means "every class/quorum" -- the common case for
 * a ward-wide holiday week. A non-empty list scopes the sweep to just
 * those classes (always real classes now that the cancellation page's
 * own checklist excludes the three Combined pseudo-groups, 2026-11-04 --
 * see that page's own comment).
 *
 * **Rewritten 2026-11-04 to actually honor cancellation as this app's
 * HIGHEST-priority source** (the user's own words: "The cancellation
 * page holds the highest priority. When it cancels something the
 * affected groups planned activities show up as cancelled. If there is
 * not a planned activity for that group for that week an activity is
 * input to show that the activity is cancelled"). The original version
 * only ever updated a row that already existed, keyed directly on
 * `group_name` -- two real gaps:
 * 1. A class with no row at all for a cancelled week (no individual
 *    activity, no Combined activity covering it) never got anything --
 *    no row, no "Cancelled" showing anywhere, contradicting the rule
 *    just quoted.
 * 2. Filtering straight on `group_name` can't safely touch a SHARED
 *    Combined row when only *some* of its attending classes are
 *    actually in this cancellation's own `group_names` -- blindly
 *    cancelling "Combined YW" because only Builders of Faith is listed
 *    would wrongly cancel it for Gatherers of Light and Messengers of
 *    Hope too.
 *
 * Works per cancellation, per real class/quorum (never a Combined
 * pseudo-group), per Wednesday actually inside its date range -- the
 * same cadence `getClassActivityGrid` already assumes elsewhere in
 * this app:
 * - An existing INDIVIDUAL row for that class -> just mark it
 *   cancelled (unless already cancelled).
 * - A SHARED Combined row covers it and every other class that row
 *   also covers is in this same cancellation's own affected set (or
 *   `group_names` is empty, meaning every class is affected) -> safe
 *   to cancel the shared row directly, once, regardless of how many
 *   affected classes resolve to it.
 * - A SHARED Combined row covers it but NOT every class it covers is
 *   affected -> can't touch the shared row (would wrongly cancel an
 *   unaffected class too) -- give this one class its own individual
 *   row instead, cancelled, which `resolveForClass`'s own "individual
 *   row wins" rule means takes over display for this class alone while
 *   the shared row (and every other class still reading it live) is
 *   untouched.
 * - Nothing covers it at all -> insert a brand-new individual row,
 *   cancelled, with no real content (`CANCELLED_PLACEHOLDER_TITLE`) --
 *   the literal fix for gap 1 above.
 */
export async function sweepYouthActivityCancellations(): Promise<void> {
  const cancellations = await getYouthActivityCancellations();
  if (cancellations.length === 0) return;

  const supabase = await createClient();

  for (const c of cancellations) {
    const wednesdays = weeklyDates(new Date(`${c.start_date}T00:00:00`), new Date(`${c.end_date}T00:00:00`), 3);
    if (wednesdays.length === 0) continue;

    const affectedClasses = c.group_names.length > 0 ? c.group_names : ACTIVITY_CLASSES;
    const affectedSet = new Set(affectedClasses);

    const candidateGroupNames = new Set<string>(["Combined YM/YW"]);
    for (const className of affectedClasses) {
      candidateGroupNames.add(className);
      candidateGroupNames.add(combinedTypeForClass(className));
    }

    const { data } = await supabase
      .from("youth_activities")
      .select("id, activity_date, group_name, cancelled")
      .in("activity_date", wednesdays)
      .in("group_name", Array.from(candidateGroupNames));

    const byDate = new Map<string, Map<string, RawActivityRow>>();
    for (const row of (data ?? []) as RawActivityRow[]) {
      const byGroup = byDate.get(row.activity_date) ?? new Map<string, RawActivityRow>();
      byGroup.set(row.group_name, row);
      byDate.set(row.activity_date, byGroup);
    }

    const sharedRowIdsToCancel = new Set<string>();
    const individualUpdates: string[] = [];
    const inserts: { activity_date: string; group_name: string }[] = [];

    for (const activityDate of wednesdays) {
      const byGroup = byDate.get(activityDate);
      for (const className of affectedClasses) {
        const individual = byGroup?.get(className);
        if (individual) {
          if (!individual.cancelled) individualUpdates.push(individual.id);
          continue;
        }

        const shared = byGroup?.get("Combined YM/YW") ?? byGroup?.get(combinedTypeForClass(className));
        if (shared) {
          const coveredClasses = classesForCombinedGroup(shared.group_name) ?? [];
          const allCoveredAreAffected = coveredClasses.every((covered) => affectedSet.has(covered));
          if (allCoveredAreAffected) {
            if (!shared.cancelled) sharedRowIdsToCancel.add(shared.id);
          } else {
            inserts.push({ activity_date: activityDate, group_name: className });
          }
          continue;
        }

        inserts.push({ activity_date: activityDate, group_name: className });
      }
    }

    await Promise.all([
      individualUpdates.length > 0
        ? supabase.from("youth_activities").update({ cancelled: true, cancellation_note: c.reason }).in("id", individualUpdates)
        : null,
      sharedRowIdsToCancel.size > 0
        ? supabase
            .from("youth_activities")
            .update({ cancelled: true, cancellation_note: c.reason })
            .in("id", Array.from(sharedRowIdsToCancel))
        : null,
      inserts.length > 0
        ? supabase.from("youth_activities").insert(
            inserts.map((row) => ({
              activity_date: row.activity_date,
              activity_time: "19:00",
              title: CANCELLED_PLACEHOLDER_TITLE,
              group_name: row.group_name,
              cancelled: true,
              cancellation_note: c.reason,
              status: "published",
            }))
          )
        : null,
    ]);
  }
}
