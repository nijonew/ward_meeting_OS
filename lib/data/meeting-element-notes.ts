import { createClient } from "@/lib/supabase/server";

export interface ElementNoteValue {
  person_id: string | null;
  person_name: string | null;
  text_value: string | null;
}

/**
 * free_text / person_and_text element values for a meeting, keyed by
 * element key. Covers any element without a more specific existing home
 * (see migration 015). ward_business/stake_business are NOT read here --
 * those still live in sacrament_planning via the existing Meeting Info
 * form, to avoid two disconnected copies of the same field.
 */
export async function getElementNotes(meetingId: string): Promise<Record<string, ElementNoteValue>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meeting_element_notes")
    .select("element_key, text_value, person:person_id(id, name)")
    .eq("meeting_id", meetingId);

  const result: Record<string, ElementNoteValue> = {};
  for (const row of (data ?? []) as unknown[]) {
    const r = row as {
      element_key: string;
      text_value: string | null;
      person: { id?: string; name?: string }[] | { id?: string; name?: string } | null;
    };
    const person = Array.isArray(r.person) ? r.person[0] : r.person;
    result[r.element_key] = {
      person_id: person?.id ?? null,
      person_name: person?.name ?? null,
      text_value: r.text_value,
    };
  }
  return result;
}