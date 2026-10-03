"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };
export type SaveActionResult = { error?: string; success?: boolean };

/**
 * Actions behind /meetings/[id]/visiting-authorities (migration 053,
 * 2026-10-03) -- add/remove/save for the freely add/remove Visiting
 * Authorities list, same shape as Speakers & Music's own actions
 * (app/meetings/[id]/speakers-music-actions.ts): one row per recognized
 * authority, each a real person or a write-in guest name.
 */

async function requireBishopric(): Promise<{ userId: string } | ActionResult> {
  const { user, profile } = await getSessionUser();
  if (!user) return { error: "You must be signed in." };
  if (profile?.role !== "bishopric") return { error: "Not authorized." };
  return { userId: user.id };
}

function revalidateBoth(meetingId: string) {
  revalidatePath(`/meetings/${meetingId}/visiting-authorities`);
  revalidatePath(`/meetings/${meetingId}/planning`);
}

export async function addVisitingAuthority(meetingId: string): Promise<ActionResult> {
  const auth = await requireBishopric();
  if (!("userId" in auth)) return auth;
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("sacrament_visiting_authorities")
    .select("sort_order")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSortOrder = ((last as { sort_order: number }[] | null)?.[0]?.sort_order ?? 0) + 10;

  const { error } = await supabase
    .from("sacrament_visiting_authorities")
    .insert({ meeting_id: meetingId, sort_order: nextSortOrder });
  if (error) return { error: error.message };

  revalidateBoth(meetingId);
  return { success: true };
}

export async function removeVisitingAuthority(id: string, meetingId: string): Promise<ActionResult> {
  const auth = await requireBishopric();
  if (!("userId" in auth)) return auth;
  const supabase = await createClient();

  const { error } = await supabase.from("sacrament_visiting_authorities").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateBoth(meetingId);
  return { success: true };
}

/** `_prevState` exists only so this can be bound into useActionState
 *  (see VisitingAuthoritiesSection.tsx) -- same reasoning as
 *  saveProgramSpeaker's own comment: a bare async form action gets
 *  auto-reset by React once it completes, which would blank this field
 *  right after every successful save. */
export async function saveVisitingAuthority(
  id: string,
  meetingId: string,
  _prevState: SaveActionResult,
  formData: FormData
): Promise<SaveActionResult> {
  const auth = await requireBishopric();
  if (!("userId" in auth)) return auth;
  const supabase = await createClient();

  const personId = String(formData.get("person_id") ?? "") || null;
  const guestName = String(formData.get("guest_name") ?? "").trim() || null;

  const { error } = await supabase
    .from("sacrament_visiting_authorities")
    .update({ person_id: personId, guest_name: guestName })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateBoth(meetingId);
  return { success: true };
}
