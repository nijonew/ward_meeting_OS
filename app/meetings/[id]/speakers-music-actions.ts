"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { kindOfItemKey } from "@/lib/data/sacrament-program";

type ActionResult = { success: true } | { error: string };

/**
 * Actions behind /meetings/[id]/speakers-music (2026-09-09) -- the
 * freely add/remove/reorderable Speakers & Music list the user asked
 * for after "trying to explain [it] for some time": a dropdown that
 * picks one of Youth Speaker 1-9 / Speaker 1-9 / Musical Number 1-9 /
 * Intermediate Hymn / Testimony, added or removed as its own line, in
 * whatever order.
 *
 * `sacrament_program_items` (migration 046) tracks only order and
 * membership; the actual data for each item lives in the same
 * sacrament_speakers_adults/youth and sacrament_music tables every
 * other part of this app already reads, keyed by the item's own
 * `item_key` as their `slot` -- these actions never introduce a second
 * copy of that data.
 */

async function requireBishopric(): Promise<{ userId: string } | ActionResult> {
  const { user, profile } = await getSessionUser();
  if (!user) return { error: "You must be signed in." };
  if (profile?.role !== "bishopric") return { error: "Not authorized." };
  return { userId: user.id };
}

function revalidateBoth(meetingId: string) {
  revalidatePath(`/meetings/${meetingId}/speakers-music`);
  revalidatePath(`/meetings/${meetingId}/planning`);
}

/**
 * Adds one item to the list. `itemKeyInput` is the dropdown's own
 * value -- a real slot ("speaker_3") for the numbered kinds, or the
 * bare kind name for the two that aren't numbered ("testimony",
 * "intermediate_hymn"). Intermediate Hymn has no number of its own in
 * the dropdown (unlike Speaker/Youth Speaker/Musical Number, which are
 * explicitly numbered 1-9) -- the next free intermediate_hymn_N slot is
 * assigned automatically here, the same positional numbering
 * sacrament_music.slot already used for repeatable hymns before this
 * rework.
 */
export async function addProgramItem(meetingId: string, itemKeyInput: string): Promise<ActionResult> {
  const auth = await requireBishopric();
  if (!("userId" in auth)) return auth;
  const supabase = await createClient();

  let itemKey = itemKeyInput;
  if (itemKeyInput === "intermediate_hymn") {
    const { data: existing } = await supabase
      .from("sacrament_program_items")
      .select("item_key")
      .eq("meeting_id", meetingId)
      .like("item_key", "intermediate_hymn%");
    const used = (existing ?? [])
      .map((r) => Number.parseInt(String(r.item_key).replace("intermediate_hymn_", ""), 10))
      .filter((n) => Number.isFinite(n));
    itemKey = `intermediate_hymn_${used.length > 0 ? Math.max(...used) + 1 : 1}`;
  }

  const { data: last } = await supabase
    .from("sacrament_program_items")
    .select("sort_order")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSortOrder = ((last as { sort_order: number }[] | null)?.[0]?.sort_order ?? 0) + 10;

  const { error } = await supabase
    .from("sacrament_program_items")
    .insert({ meeting_id: meetingId, item_key: itemKey, sort_order: nextSortOrder });
  if (error) return { error: error.message };

  revalidateBoth(meetingId);
  return { success: true };
}

/** Removes the list entry AND its underlying speaker/music row -- an
 *  orphaned row no agenda line points to would just be confusing dead
 *  data otherwise. Testimony has no underlying row to clean up. */
export async function removeProgramItem(itemId: string, meetingId: string): Promise<ActionResult> {
  const auth = await requireBishopric();
  if (!("userId" in auth)) return auth;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("sacrament_program_items")
    .select("item_key")
    .eq("id", itemId)
    .maybeSingle();

  const { error } = await supabase.from("sacrament_program_items").delete().eq("id", itemId);
  if (error) return { error: error.message };

  if (item) {
    const kind = kindOfItemKey(item.item_key);
    if (kind === "speaker") {
      await supabase.from("sacrament_speakers_adults").delete().eq("meeting_id", meetingId).eq("slot", item.item_key);
    } else if (kind === "youth_speaker") {
      await supabase.from("sacrament_speakers_youth").delete().eq("meeting_id", meetingId).eq("slot", item.item_key);
    } else if (kind === "musical_number" || kind === "intermediate_hymn") {
      await supabase.from("sacrament_music").delete().eq("meeting_id", meetingId).eq("slot", item.item_key);
    }
  }

  revalidateBoth(meetingId);
  return { success: true };
}

export async function moveProgramItem(meetingId: string, itemId: string, direction: "up" | "down"): Promise<ActionResult> {
  const auth = await requireBishopric();
  if (!("userId" in auth)) return auth;
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("sacrament_program_items")
    .select("id, sort_order")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true });
  if (!items) return { error: "Could not load items." };

  const idx = items.findIndex((i) => i.id === itemId);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapWith < 0 || swapWith >= items.length) return { success: true };

  const a = items[idx] as { id: string; sort_order: number };
  const b = items[swapWith] as { id: string; sort_order: number };
  const { error: e1 } = await supabase.from("sacrament_program_items").update({ sort_order: b.sort_order }).eq("id", a.id);
  if (e1) return { error: e1.message };
  const { error: e2 } = await supabase.from("sacrament_program_items").update({ sort_order: a.sort_order }).eq("id", b.id);
  if (e2) return { error: e2.message };

  revalidateBoth(meetingId);
  return { success: true };
}

/** Speaker/Youth Speaker fields: a person, or a guest name -- "It will
 *  not include a guest name field unless necessary" (the user's own
 *  words) is a UI-only distinction (SpeakerPersonOrGuestField hides the
 *  guest input until asked for); this write accepts either, same as
 *  every other speaker-picking form in this app. No topic field, per
 *  the same note. */
export async function saveProgramSpeaker(
  meetingId: string,
  table: "sacrament_speakers_adults" | "sacrament_speakers_youth",
  slot: string,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireBishopric();
  if (!("userId" in auth)) return auth;
  const supabase = await createClient();

  const personId = String(formData.get("person_id") ?? "") || null;
  const guestName = String(formData.get("guest_name") ?? "").trim() || null;

  const { data: existing } = await supabase.from(table).select("id").eq("meeting_id", meetingId).eq("slot", slot).limit(1);
  const existingId = (existing as { id: string }[] | null)?.[0]?.id ?? null;

  if (existingId) {
    const { error } = await supabase
      .from(table)
      .update({ speaker_id: personId, guest_speaker_name: guestName })
      .eq("id", existingId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from(table)
      .insert({ meeting_id: meetingId, slot, speaker_id: personId, guest_speaker_name: guestName });
    if (error) return { error: error.message };
  }

  revalidateBoth(meetingId);
  return { success: true };
}

/** Musical Number: Title, Individual-or-Group Name (plain text -- "It
 *  will include the information from the music planning tables (title,
 *  individual or group name, accompanist)", the user's own words),
 *  Accompanist (a real person). Intermediate Hymn: Hymn Number + Title
 *  only, same as every other hymn line in this app -- no performer/
 *  accompanist, it's congregational. */
export async function saveProgramMusic(
  meetingId: string,
  type: "musical_number" | "intermediate_hymn",
  slot: string,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requireBishopric();
  if (!("userId" in auth)) return auth;
  const supabase = await createClient();

  const hymnNumberRaw = String(formData.get("hymn_number") ?? "").trim();
  const payload: Record<string, unknown> = {
    hymn_number: hymnNumberRaw ? Number.parseInt(hymnNumberRaw, 10) : null,
    piece_name: String(formData.get("piece_name") ?? "").trim() || null,
  };
  if (type === "musical_number") {
    payload.group_name = String(formData.get("performer") ?? "").trim() || null;
    payload.accompanist_id = String(formData.get("accompanist_id") ?? "") || null;
  }

  const { data: existing } = await supabase
    .from("sacrament_music")
    .select("id")
    .eq("meeting_id", meetingId)
    .eq("slot", slot)
    .limit(1);
  const existingId = (existing as { id: string }[] | null)?.[0]?.id ?? null;

  if (existingId) {
    const { error } = await supabase.from("sacrament_music").update(payload).eq("id", existingId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("sacrament_music")
      .insert({ meeting_id: meetingId, type, slot, status: "published", submitted_by: auth.userId, ...payload });
    if (error) return { error: error.message };
  }

  revalidateBoth(meetingId);
  return { success: true };
}
