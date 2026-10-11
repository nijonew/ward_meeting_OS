import { YOUTH_ACTIVITY_GROUPS } from "@/lib/data/youth-activity-constants";
import type { YouthActivityRow } from "@/lib/data/youth-activities";

/**
 * Pure helpers (no `createClient` import, so this is safe to import
 * from a Client Component -- see lib/data/sacrament-program-shared.ts
 * for the identical reasoning/precedent in this app) shared between
 * the per-class activity grid (lib/data/class-activities.ts, server
 * only) and the "Overwrite" button on the Combined-group pages
 * (components/youth-activities/ActivitiesTable.tsx, a Client
 * Component, and its server action in app/youth-activities/actions.ts).
 */

export const YM_CLASS_NAMES = ["Deacons", "Teachers", "Priests"];
export const YW_CLASS_NAMES = ["Gatherers of Light", "Messengers of Hope", "Builders of Faith"];

/** The 6 real classes/quorums -- excludes the "Combined ..." pseudo-
 *  values, which describe attendee scope, not an actual class. */
export const ACTIVITY_CLASSES = YOUTH_ACTIVITY_GROUPS.filter((g) => !g.value.startsWith("Combined")).map((g) => g.value);

const YM_CLASS_SET = new Set(YM_CLASS_NAMES);

/** Which single-gender combined type a class belongs to -- every class
 *  also belongs to "Combined YM/YW" (everyone), checked separately. */
export function combinedTypeForClass(className: string): string {
  return YM_CLASS_SET.has(className) ? "Combined YM" : "Combined YW";
}

/** The classes a Combined activity's "Overwrite" button should stamp a
 *  copy onto -- null for anything that isn't one of the three Combined
 *  group names. */
export function classesForCombinedGroup(groupName: string): string[] | null {
  if (groupName === "Combined YM") return YM_CLASS_NAMES;
  if (groupName === "Combined YW") return YW_CLASS_NAMES;
  if (groupName === "Combined YM/YW") return [...YM_CLASS_NAMES, ...YW_CLASS_NAMES];
  return null;
}

/**
 * Which of a class's candidate rows on one date actually applies to
 * it, given a `group_name -> row` map for that date -- shared by
 * `getClassActivityGrid` and `explodeActivitiesByClass` below so the
 * two can't drift apart. Precedence: this class's own individual
 * activity first; otherwise Combined YM/YW (2026-10-11, the user's own
 * explicit rule: "if it is a combined YM/YW that will overwrite any
 * combined YM or combined YW activity"); otherwise this class's own
 * single-gender Combined type. In practice the last two never both
 * exist for the same real date (the fixed nth-Wednesday cadence makes
 * them mutually exclusive), so this only matters defensively -- but
 * it's the one place that rule is encoded, not duplicated.
 */
export function resolveForClass<T extends { group_name: string }>(
  byGroup: Map<string, T> | undefined,
  className: string
): T | undefined {
  if (!byGroup) return undefined;
  return byGroup.get(className) ?? byGroup.get("Combined YM/YW") ?? byGroup.get(combinedTypeForClass(className));
}

/**
 * "For the upcoming activities lists please note that I only want to
 * see a listing for each of the 6 groups. So if it is a combined
 * YM/YW that will overwrite any combined YM or combined YW activity
 * listed in those tables. And a note can be added to each group that
 * it is a combined YM/YW. Same for when a combined YM or combined YW
 * activity is listed -- no need to list those types as group. Just
 * note in the notes that it is a combined YM or combined YW activity"
 * (the user's own request, 2026-10-11).
 *
 * Takes the raw `youth_activities` rows (which include literal
 * "Combined YM"/"Combined YW"/"Combined YM/YW" rows) and re-attributes
 * each date to the up-to-6 real classes it actually applies to, using
 * `resolveForClass`'s precedence -- a Combined YM/YW date produces 6
 * rows (one per class), a Combined YM date produces 3 (Deacons/
 * Teachers/Priests), and so on; a plain individual-week date produces
 * exactly 1. A Combined-sourced row gets its own synthetic id
 * (`<sourceId>::<className>`, since up to 6 rows can share one real
 * underlying row -- React's own key, not a real `youth_activities.id`,
 * so this is only safe for a read-only view with no row-level action
 * keyed on `id`) and a "<group> activity." note prepended to whatever
 * real notes it already had, rather than ever showing "Combined ..."
 * in the Group column itself.
 */
export function explodeActivitiesByClass(activities: YouthActivityRow[]): YouthActivityRow[] {
  const byDate = new Map<string, Map<string, YouthActivityRow>>();
  for (const a of activities) {
    const byGroup = byDate.get(a.activity_date) ?? new Map<string, YouthActivityRow>();
    byGroup.set(a.group_name, a);
    byDate.set(a.activity_date, byGroup);
  }

  const result: YouthActivityRow[] = [];
  for (const [, byGroup] of byDate) {
    for (const className of ACTIVITY_CLASSES) {
      const source = resolveForClass(byGroup, className);
      if (!source) continue;

      const isCombined = source.group_name !== className;
      result.push({
        ...source,
        id: isCombined ? `${source.id}::${className}` : source.id,
        group_name: className,
        notes: isCombined ? [`${source.group_name} activity.`, source.notes].filter(Boolean).join(" ") : source.notes,
      });
    }
  }

  // Stable sort -- ties (same date) keep their insertion order, which
  // already follows ACTIVITY_CLASSES' own fixed order per date.
  return result.sort((a, b) => a.activity_date.localeCompare(b.activity_date));
}
