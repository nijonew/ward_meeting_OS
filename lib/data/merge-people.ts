import { createClient } from "@/lib/supabase/server";

/**
 * Merge Duplicate People -- built 2026-10-31 (the user's own request,
 * after confirming PROJECT_CONTEXT.md's own claim of "paused research"
 * on this didn't actually exist anywhere in the file: "Yes, design and
 * build it"). See migration 096 for the real mechanics -- both
 * list_people_references/merge_people are catalog-driven Postgres
 * functions, not hardcoded against a table list this assistant has no
 * live-database way to confirm is complete.
 */

export interface MergeCandidate {
  id: string;
  name: string;
  archived: boolean;
}

/** Every person, active or archived -- a duplicate pair can easily
 *  include one already-archived row (e.g. someone archived the wrong
 *  one of two before the real fix for this existed), so this
 *  deliberately doesn't filter the way getActivePeople() does. */
export async function getAllPeopleForMerge(): Promise<MergeCandidate[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("people").select("id, name, archived_at").order("name");
  return ((data ?? []) as { id: string; name: string; archived_at: string | null }[]).map((p) => ({
    id: p.id,
    name: p.name,
    archived: Boolean(p.archived_at),
  }));
}

export interface PersonMergeDetail {
  id: string;
  name: string;
  gender: string | null;
  ageGroup: string | null;
  attendanceStatus: string | null;
  active: boolean;
  archived: boolean;
  hasLogin: boolean;
  references: { table: string; column: string; count: number }[];
}

/** One person's own fields (gender/age_group/etc. are NEVER auto-merged
 *  by merge_people -- shown here so the admin can see, before
 *  confirming, whether the person they're about to delete has anything
 *  worth copying into the survivor by hand first) plus a live
 *  reference-count breakdown, via list_people_references -- "what will
 *  actually move, and where" rather than a guess. */
export async function getPersonMergeDetail(personId: string): Promise<PersonMergeDetail | null> {
  const supabase = await createClient();
  const { data: person } = await supabase
    .from("people")
    .select("id, name, gender, age_group, attendance_status, active, archived_at, profile_id")
    .eq("id", personId)
    .maybeSingle();
  if (!person) return null;

  const { data: refs } = await supabase.rpc("list_people_references", { target_id: personId });

  return {
    id: person.id,
    name: person.name,
    gender: person.gender,
    ageGroup: person.age_group,
    attendanceStatus: person.attendance_status,
    active: Boolean(person.active),
    archived: Boolean(person.archived_at),
    hasLogin: Boolean(person.profile_id),
    references: ((refs ?? []) as { table_name: string; column_name: string; row_count: number }[]).map((r) => ({
      table: r.table_name,
      column: r.column_name,
      count: r.row_count,
    })),
  };
}
