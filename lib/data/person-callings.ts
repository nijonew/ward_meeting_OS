import { createClient } from "@/lib/supabase/server";

export interface CallingAssignmentOption {
  id: string;
  name: string;
  /** Whoever else currently holds this calling, if anyone -- shown next
   *  to its checkbox so checking it for a different person is never a
   *  surprise reassignment (`callings.current_holder_id` is a single
   *  nullable FK per calling row, not a join table). Null for a calling
   *  this person already holds, or one that's vacant. */
  currentHolderName: string | null;
}

/**
 * Every calling, each flagged with whoever else currently holds it --
 * the checklist for /admin/person-callings. Deliberately unfiltered by
 * `active`, matching Calling Planning's own "include any and all
 * callings" convention (getCallingOptions, lib/data/calling-planning.ts)
 * -- assigning callings is exactly the kind of place a soon-to-be-
 * reactivated calling needs to be reachable.
 */
export async function getCallingAssignmentOptions(excludePersonId: string): Promise<CallingAssignmentOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("callings")
    .select("id, name, current_holder_id, people:current_holder_id(name)")
    .order("sort_order");

  if (error || !data) return [];

  return (data as unknown[]).map((row) => {
    const r = row as {
      id: string;
      name: string;
      current_holder_id: string | null;
      people: { name?: string } | { name?: string }[] | null;
    };
    const holder = Array.isArray(r.people) ? r.people[0] : r.people;
    const heldByOther = r.current_holder_id && r.current_holder_id !== excludePersonId;
    return {
      id: r.id,
      name: r.name,
      currentHolderName: heldByOther ? holder?.name ?? null : null,
    };
  });
}

/** Which callings a specific person currently holds -- the checklist's pre-checked state. */
export async function getPersonCallingIds(personId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("callings").select("id").eq("current_holder_id", personId);
  return error || !data ? new Set() : new Set(data.map((r) => r.id as string));
}
