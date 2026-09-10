import { createClient } from "@/lib/supabase/server";
import type { ProgramItemRow } from "@/lib/data/sacrament-program-shared";

/**
 * The "Speakers & Music" portion of Sacrament Meeting, rebuilt
 * 2026-09-09 as its own freely add/remove/reorderable list, per the
 * user's own words -- something they'd tried to explain "for some
 * time": "the speakers and music portion of the meeting should have a
 * dynamic number of elements where elements can be added or removed.
 * Each will have a dropdown which will allow the selection of youth
 * speakers 1-9, speakers 1-9, musical numbers 1-9, intermediate hymn,
 * testimonies."
 *
 * `sacrament_program_items` (migration 046) tracks only order and
 * membership -- one row per chosen item, keyed by `item_key`, which
 * matches the exact `slot` value already used in
 * sacrament_speakers_adults/youth.slot and sacrament_music.slot (e.g.
 * "speaker_3", "musical_number_5"), or the bare string "testimony" for
 * an open-testimony placeholder with no underlying data row at all.
 * The actual speaker/music data still lives in those existing tables --
 * this table never duplicates it.
 *
 * The types/pure helpers (option lists, item-key parsing, resolving a
 * row's current values) live in sacrament-program-shared.ts instead of
 * here, and are re-exported below for convenience -- that file has no
 * `createClient` import, so SacramentProgramSection (a Client
 * Component) can import the parts it needs directly from it without
 * pulling this file's `next/headers` dependency into the client
 * bundle. Server-side callers can keep importing everything from this
 * one file as before.
 */
export * from "@/lib/data/sacrament-program-shared";

export async function getSacramentProgramItems(meetingId: string): Promise<ProgramItemRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sacrament_program_items")
    .select("id, item_key, sort_order")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => ({ id: row.id, itemKey: row.item_key, sortOrder: row.sort_order }));
}
