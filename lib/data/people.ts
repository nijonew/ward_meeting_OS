import { createClient } from "@/lib/supabase/server";

export interface PersonOption {
  id: string;
  name: string;
}

/**
 * Also excludes archived people (`archived_at is not null`), not just
 * inactive ones -- bug fix, 2026-11-14, the user's own report:
 * "archived people showing up in dropdowns for callings." Archiving a
 * person (`/admin/archived-people`, migration 091's `archive_person`
 * RPC) clears their calling/login link but deliberately never touches
 * `active`, so a filter on `active` alone was never enough to keep
 * them out of a dropdown -- this is the one shared source nearly every
 * person-picker in the app reads from (Verify Logins, Speaker & Prayer
 * History, Assign Callings, Music, RABNM Planning, Calling Planning,
 * every meeting's own agenda grid), so this one fix closes the gap
 * everywhere it's used. See `getForeignKeyOptions`
 * (`lib/admin/table-data.ts`) for the matching fix on Table Admin's own
 * raw person-reference dropdowns, which don't go through this function.
 */
export async function getActivePeople(): Promise<PersonOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, name")
    .eq("active", true)
    .is("archived_at", null)
    .order("name");

  return error || !data ? [] : data;
}
