import { createClient } from "@/lib/supabase/server";
import { getActivePeople } from "@/lib/data/people";

export interface CallingDetail {
  id: string;
  name: string;
  title_prefix: string | null;
  current_holder_id: string | null;
  current_holder_name: string | null;
  active: boolean;
}

/** Fallback options if admin_select_options has no rows yet for these
 *  fields -- see lib/data/select-options.ts. Also what the migration
 *  022_admin_select_options.sql seeds the table with, so switching over
 *  to the DB-backed list is a no-op until someone actually edits it. */
export const DEFAULT_CALLING_STATUSES = [
  { value: "discussing", label: "Discussing" },
  { value: "future", label: "Future" },
  { value: "declined", label: "Declined" },
  { value: "to_announce", label: "To Announce in Sacrament" },
  { value: "to_be_set_apart", label: "To Be Set Apart" },
  { value: "to_record", label: "To Record" },
  { value: "complete", label: "Complete" },
];

export const DEFAULT_RELEASE_STATUSES = [
  { value: "previously_vacant", label: "Previously Vacant" },
  { value: "discussing", label: "Discussing" },
  { value: "to_announce", label: "To Announce in Sacrament" },
  { value: "to_record", label: "To Record" },
  { value: "complete", label: "Complete" },
];

export interface CallingPlanningRow {
  id: string;
  calling_id: string;
  calling_name: string;
  calling_title_prefix: string | null;
  date_initiated: string | null;
  /** Who's under consideration -- multi-select, real people (migration
   *  044 replaced the free-text Candidates field and the single-select
   *  Selected Person with this one multi-valued column). Once narrowed
   *  to exactly one, that's who the Sacrament Meeting push treats as
   *  decided -- see pushCallingToSacramentMeeting. */
  candidate_person_ids: string[];
  calling_status: string;
  date_set_apart: string | null;
  release_person_id: string | null;
  release_status: string;
  notes: string | null;
  announced_meeting_id: string | null;
  created_at: string;
}

export interface CallingOption {
  id: string;
  name: string;
  title_prefix: string | null;
}

export function personName(rel: unknown): string | null {
  if (Array.isArray(rel)) return (rel[0] as { name?: string } | undefined)?.name ?? null;
  return (rel as { name?: string } | null)?.name ?? null;
}

export async function getCallingDetail(callingId: string): Promise<CallingDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("callings")
    .select("id, name, title_prefix, current_holder_id, active, people:current_holder_id(name)")
    .eq("id", callingId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    title_prefix: data.title_prefix,
    current_holder_id: data.current_holder_id,
    current_holder_name: personName(data.people),
    active: data.active,
  };
}

/**
 * Every calling, filled or vacant, active or not -- for the grid's
 * "Calling" dropdown. Deliberately unfiltered (2026-09-08, the user's
 * own report: "the list of potential callings seems to pull only from
 * callings that are already filled... I need to include any and all
 * callings") -- planning a change is exactly the workflow that needs
 * to reach a calling with no current holder, so filtering on
 * `active`/`current_holder_id` here would work directly against the
 * feature's own purpose. Ordered the same way the roster itself is
 * (sort_order), not alphabetically, so it matches whatever order the
 * ward already thinks of callings in.
 */
export async function getCallingOptions(): Promise<CallingOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("callings")
    .select("id, name, title_prefix")
    .order("sort_order");

  return error || !data ? [] : data;
}

export interface CallableCallingItem {
  /** calling_planning.id -- what Ward Business's pull/un-pull actions
   *  key off (app/meetings/[id]/ward-business-actions.ts). */
  id: string;
  callingId: string;
  callingName: string;
  personId: string;
  personName: string;
  /** calling_status/release_status is already "To Announce in
   *  Sacrament" -- surfaced first, as a ready-made suggestion. */
  ready: boolean;
}

/**
 * Calling Planning rows not yet announced in any meeting, split into
 * "Callings" (a single narrowed-down candidate) and "Releases" (a
 * release person set) -- for Ward Business's inline Calling Planning
 * picker (2026-10-03, the user's own request: "prefilled with items
 * from calling planning that are listed as ready to announce... the
 * ability to call in other items from calling planning even if they
 * aren't marked as ready"). `ready` flags the ones already marked "To
 * Announce in Sacrament" (pushCallingToSacramentMeeting's own
 * threshold) -- everything else is still returned, just not
 * pre-suggested, so an admin can pull one in early if they choose to.
 *
 * A calling_status row with more than one candidate is left out of the
 * Callings list entirely -- same rule pushCallingToSacramentMeeting
 * already enforces: there's no single person yet to announce. A row
 * can appear in both lists at once (e.g. a presidency change with both
 * a new calling and a release pending).
 */
export async function getCallableCallingPlanningItems(): Promise<{
  callings: CallableCallingItem[];
  releases: CallableCallingItem[];
}> {
  const supabase = await createClient();
  const [{ data: rows }, people] = await Promise.all([
    supabase
      .from("calling_planning")
      .select("id, calling_status, candidate_person_ids, release_person_id, release_status, callings(id, name)")
      .is("announced_meeting_id", null),
    getActivePeople(),
  ]);

  const nameById = new Map(people.map((p) => [p.id, p.name]));
  const callings: CallableCallingItem[] = [];
  const releases: CallableCallingItem[] = [];

  for (const row of (rows ?? []) as unknown[]) {
    const r = row as {
      id: string;
      calling_status: string;
      candidate_person_ids: string[] | null;
      release_person_id: string | null;
      release_status: string;
      callings: { id: string; name: string } | { id: string; name: string }[] | null;
    };
    const calling = Array.isArray(r.callings) ? r.callings[0] : r.callings;
    if (!calling) continue;

    const candidateIds = r.candidate_person_ids ?? [];
    if (candidateIds.length === 1) {
      const personName = nameById.get(candidateIds[0]);
      if (personName) {
        callings.push({
          id: r.id,
          callingId: calling.id,
          callingName: calling.name,
          personId: candidateIds[0],
          personName,
          ready: r.calling_status === "to_announce",
        });
      }
    }

    if (r.release_person_id) {
      const personName = nameById.get(r.release_person_id);
      if (personName) {
        releases.push({
          id: r.id,
          callingId: calling.id,
          callingName: calling.name,
          personId: r.release_person_id,
          personName,
          ready: r.release_status === "to_announce",
        });
      }
    }
  }

  return { callings, releases };
}

/**
 * Every calling-planning row, across every calling, one row per
 * potential calling change -- the flat grid the user's own spreadsheet
 * models this on. Pass callingId to scope to just one calling (used by
 * the calling detail page's "changes involving this calling" link).
 */
export async function getAllCallingPlanningRows(callingId?: string): Promise<CallingPlanningRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("calling_planning")
    .select(
      "id, calling_id, date_initiated, candidate_person_ids, calling_status, date_set_apart, release_person_id, release_status, notes, announced_meeting_id, created_at, callings(name, title_prefix)"
    )
    .order("created_at", { ascending: false });

  if (callingId) {
    query = query.eq("calling_id", callingId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as unknown[]).map((row) => {
    const r = row as {
      id: string;
      calling_id: string;
      date_initiated: string | null;
      candidate_person_ids: string[] | null;
      calling_status: string;
      date_set_apart: string | null;
      release_person_id: string | null;
      release_status: string;
      notes: string | null;
      announced_meeting_id: string | null;
      created_at: string;
      callings: { name?: string; title_prefix?: string | null } | { name?: string; title_prefix?: string | null }[] | null;
    };
    const calling = Array.isArray(r.callings) ? r.callings[0] : r.callings;

    return {
      id: r.id,
      calling_id: r.calling_id,
      calling_name: calling?.name ?? "(unknown calling)",
      calling_title_prefix: calling?.title_prefix ?? null,
      date_initiated: r.date_initiated,
      candidate_person_ids: r.candidate_person_ids ?? [],
      calling_status: r.calling_status,
      date_set_apart: r.date_set_apart,
      release_person_id: r.release_person_id,
      release_status: r.release_status,
      notes: r.notes,
      announced_meeting_id: r.announced_meeting_id,
      created_at: r.created_at,
    };
  });
}
