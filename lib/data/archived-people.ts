import { createClient } from "@/lib/supabase/server";

/**
 * The flip side of People's own Delete-now-archives behavior
 * (2026-10-30, migration 091, the user's own request: "when someone is
 * deleted from the people page they should be added to a new archived
 * people page"). `archive_person` (the Postgres function Delete calls
 * instead of a real delete) already clears the person's calling
 * assignment(s) and login link and sets `archived_at` -- this file is
 * just the read side for the dedicated page that lists them back out.
 */
export interface ArchivedPerson {
  id: string;
  name: string;
  archived_at: string;
}

export async function getArchivedPeople(): Promise<ArchivedPerson[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("people")
    .select("id, name, archived_at")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  return (data ?? []) as ArchivedPerson[];
}
