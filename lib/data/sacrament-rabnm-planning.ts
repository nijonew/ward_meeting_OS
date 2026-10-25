import { createClient } from "@/lib/supabase/server";
import { RABNM_PLANNING_TYPES } from "@/lib/data/sacrament-constants";

export type RabnmPlanningType = (typeof RABNM_PLANNING_TYPES)[number]["value"];

export interface RabnmPlanningRow {
  id: string;
  type: RabnmPlanningType;
  detail: string | null;
  event_date: string | null;
  people: { id: string; name: string }[];
}

function peopleFromJoin(rel: unknown): { id: string; name: string }[] {
  const rows = (rel ?? []) as { people: { id?: string; name?: string } | null }[];
  return rows
    .map((r) => (r.people?.id && r.people?.name ? { id: r.people.id, name: r.people.name } : null))
    .filter((p): p is { id: string; name: string } => Boolean(p));
}

/**
 * The standing RABNM planning pool (migration 082) -- every
 * not-yet-announced row, grouped by category, for the simple add/
 * remove-row planning page (/rabnm-planning). Mirrors
 * getAllCallingPlanningRows's own shape, scoped down to just the pool
 * (not a flat history) since this page has no "already announced"
 * view of its own -- Table Admin's sacrament_rabnm_planning entry is
 * where a historical or in-progress row can still be seen.
 */
export async function getRabnmPlanningPool(): Promise<Record<RabnmPlanningType, RabnmPlanningRow[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sacrament_rabnm_planning")
    .select("id, type, detail, event_date, sacrament_rabnm_planning_people(people(id, name))")
    .is("announced_meeting_id", null)
    .order("created_at", { ascending: true });

  const byType: Record<RabnmPlanningType, RabnmPlanningRow[]> = {
    recognition: [],
    advancement: [],
    baptism: [],
    new_member: [],
    baby_blessing: [],
  };

  if (error || !data) return byType;

  for (const row of data as unknown[]) {
    const r = row as {
      id: string;
      type: string;
      detail: string | null;
      event_date: string | null;
      sacrament_rabnm_planning_people: unknown;
    };
    const type = r.type as RabnmPlanningType;
    if (!(type in byType)) continue;
    byType[type].push({
      id: r.id,
      type,
      detail: r.detail,
      event_date: r.event_date,
      people: peopleFromJoin(r.sacrament_rabnm_planning_people),
    });
  }

  return byType;
}

export interface CallableRabnmItem {
  /** sacrament_rabnm_planning.id -- what Ward Business's pull/remove
   *  actions key off (pullRabnmPlanningIntoMeeting). */
  id: string;
  type: RabnmPlanningType;
  label: string;
}

/**
 * Every not-yet-announced pool row, flattened and labeled for Ward
 * Business's single "Add to Ward Business" dropdown (an <optgroup>
 * per category) -- the RABNM-planning counterpart to
 * getCallableCallingPlanningItems.
 */
export async function getCallableRabnmPlanningItems(): Promise<CallableRabnmItem[]> {
  const pool = await getRabnmPlanningPool();
  const items: CallableRabnmItem[] = [];

  for (const category of RABNM_PLANNING_TYPES) {
    for (const row of pool[category.value]) {
      const peopleLabel = row.people.map((p) => p.name).join(", ");
      const label = [peopleLabel, row.detail].filter(Boolean).join(" -- ") || "(no detail)";
      items.push({ id: row.id, type: category.value, label });
    }
  }

  return items;
}
