import { createClient } from "@/lib/supabase/server";
import { personName } from "@/lib/data/calling-planning";

/**
 * The only four values `callings.title_prefix` should ever hold going
 * forward (2026-11-05, the user's own request) -- confirmed directly
 * with the user before building this: NOT just "Brother/Sister" and
 * "President" on their own (that would have left Presiding/Conducting's
 * "Bishop `<name>`" and Visiting Authorities' "Elder `<name>`" with
 * nowhere to come from, since both are already read from this exact
 * column -- see `getTitlePrefixesForAssignments`,
 * `lib/data/person-display.ts`). "Brother/Sister" is a real, live
 * value here, not just a label -- `getTitlePrefixesForAssignments`
 * resolves it per the specific person actually holding the calling,
 * "Brother" for a male holder and "Sister" for a female one, at the
 * moment a title is displayed, not at the moment this is set. A
 * calling can still have no title at all -- the field stays nullable,
 * same as before.
 */
export const CALLING_TITLE_PREFIXES = [
  { value: "President", label: "President" },
  { value: "Bishop", label: "Bishop" },
  { value: "Elder", label: "Elder" },
  { value: "Brother/Sister", label: "Brother/Sister" },
] as const;

export interface CallingOption {
  id: string;
  name: string;
  title_prefix: string | null;
}

export interface CallingListItem {
  id: string;
  name: string;
  title_prefix: string | null;
  current_holder_name: string | null;
  active: boolean;
}

export async function getActiveCallings(): Promise<CallingOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("callings")
    .select("id, name, title_prefix")
    .eq("active", true)
    .order("sort_order");

  return error || !data ? [] : data;
}

/** Who currently holds a specific calling, by its exact name -- used
 *  2026-09-09 to default the Presiding agenda row to the Bishop
 *  (the user's own request) without needing a whole rotation/eligibility
 *  round trip just for one person. Null if the calling doesn't exist,
 *  isn't active, or is vacant. */
export async function getCurrentHolderIdByCallingName(name: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("callings")
    .select("current_holder_id")
    .eq("name", name)
    .eq("active", true)
    .maybeSingle();

  return data?.current_holder_id ?? null;
}

/**
 * Every active calling linked to a given meeting type via
 * meeting_type_members -- scopes the "Add a calling..." rotation-member
 * picker (2026-10-31, the user's own request: "I want only the callings
 * associated with the meetings in the dropdowns to create the
 * rotations") to callings that actually participate in that meeting
 * type, rather than every calling in the ward roster. Uses the same
 * relationship-embedding query shape lib/data/rotations.ts and
 * lib/data/meeting-type-access.ts already use successfully for this
 * same table, rather than assuming its FK column is literally named
 * `calling_id`.
 */
export async function getCallingsForMeetingType(meetingTypeId: string): Promise<CallingOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meeting_type_members")
    .select("callings!inner(id, name, title_prefix, active)")
    .eq("meeting_type_id", meetingTypeId)
    .eq("callings.active", true);

  const seen = new Set<string>();
  const result: CallingOption[] = [];
  for (const row of (data ?? []) as unknown[]) {
    const r = row as { callings: CallingOption[] | CallingOption | null };
    const calling = Array.isArray(r.callings) ? r.callings[0] : r.callings;
    if (!calling || seen.has(calling.id)) continue;
    seen.add(calling.id);
    result.push(calling);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAllCallings(): Promise<CallingListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("callings")
    .select("id, name, title_prefix, active, people:current_holder_id(name)")
    .order("sort_order");

  if (error || !data) return [];

  return (data as unknown[]).map((row) => {
    const r = row as {
      id: string;
      name: string;
      title_prefix: string | null;
      active: boolean;
      people: unknown;
    };

    return {
      id: r.id,
      name: r.name,
      title_prefix: r.title_prefix,
      current_holder_name: personName(r.people),
      active: r.active,
    };
  });
}
