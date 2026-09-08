"use server";

import { revalidatePath } from "next/cache";
import { addMeetingCancellation, deleteMeetingCancellation } from "@/lib/data/meeting-cancellations";

type ActionResult = { success: true } | { error: string };

export async function addMeetingCancellationAction(formData: FormData): Promise<ActionResult> {
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
  const result = await deleteMeetingCancellation(id);
  if ("success" in result) revalidatePath("/meeting-cancellations");
  return result;
}
