"use server";

import { revalidatePath } from "next/cache";
import { addMeetingCancellation, deleteMeetingCancellation } from "@/lib/data/meeting-cancellations";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };

// Neither action here had any server-side check at all before this
// (2026-10-04, found while converting the page's own gate to the
// granular-features model) -- only the page's own gate kept the
// controls out of a non-admin's view, the same gap already found and
// fixed for several other actions this session.
async function requireMeetingCancellationsFeature(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "meeting_cancellations")) return { error: "Not authorized." };
  return null;
}

export async function addMeetingCancellationAction(formData: FormData): Promise<ActionResult> {
  const denied = await requireMeetingCancellationsFeature();
  if (denied) return denied;
  const result = await addMeetingCancellation(formData);
  if ("success" in result) {
    revalidatePath("/meeting-cancellations");
    revalidatePath("/dashboard");
    revalidatePath("/youth-activities");
    revalidatePath("/events");
  }
  return result;
}

export async function deleteMeetingCancellationAction(id: string): Promise<ActionResult> {
  const denied = await requireMeetingCancellationsFeature();
  if (denied) return denied;
  const result = await deleteMeetingCancellation(id);
  if ("success" in result) revalidatePath("/meeting-cancellations");
  return result;
}
