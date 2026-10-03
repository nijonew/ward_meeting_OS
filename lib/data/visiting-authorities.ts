import { createClient } from "@/lib/supabase/server";

/**
 * Visiting Authorities (migration 053, 2026-10-03) -- a freely
 * add/remove list of recognized visitors for one Sacrament Meeting,
 * each either a real person (calling-restricted to Stake Presidency +
 * High Council, see lib/data/rotations.ts's VISITING_AUTHORITY_CALLING_NAMES/
 * VISITING_AUTHORITY_CALLING_NAME_PREFIXES) or a write-in guest name.
 * See that migration's own comment for why
 * this is a new table rather than the free-text field this element was
 * previously (never actually) cataloged as.
 */
export interface VisitingAuthorityRow {
  id: string;
  personId: string;
  guestName: string;
  /** Resolved display name -- the person's real name, or the guest
   *  name typed in, whichever applies. Empty for a freshly-added row
   *  with neither set yet. */
  displayName: string;
}

export async function getVisitingAuthorities(meetingId: string): Promise<VisitingAuthorityRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sacrament_visiting_authorities")
    .select("id, person_id, guest_name, person:person_id(name)")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true });

  return ((data ?? []) as unknown as {
    id: string;
    person_id: string | null;
    guest_name: string | null;
    person: { name: string } | { name: string }[] | null;
  }[]).map((row) => {
    const person = Array.isArray(row.person) ? row.person[0] : row.person;
    return {
      id: row.id,
      personId: row.person_id ?? "",
      guestName: row.guest_name ?? "",
      displayName: person?.name ?? row.guest_name ?? "",
    };
  });
}
