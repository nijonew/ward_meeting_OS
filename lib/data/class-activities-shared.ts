import { YOUTH_ACTIVITY_GROUPS } from "@/lib/data/youth-activity-constants";

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
