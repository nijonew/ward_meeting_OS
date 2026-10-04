"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

export type ActionResult = { success: true } | { error: string };

// None of these had a server-side check at all before this (2026-10-04,
// found while converting the page's own gate to the granular-features
// model) -- only the page's own gate kept the controls out of a
// non-admin's view.
async function requireWardEventPlanningFeature(): Promise<{ error: string } | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "ward_event_planning")) return { error: "Not authorized." };
  return null;
}

export async function addWardEvent(formData: FormData): Promise<ActionResult> {
  const denied = await requireWardEventPlanningFeature();
  if (denied) return denied;

  const supabase = await createClient();

  const event_date = formData.get("event_date") as string;
  const event_time = (formData.get("event_time") as string) || null;
  const title = formData.get("title") as string;
  const location = (formData.get("location") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!event_date || !title) {
    return { error: "Date and title are required." };
  }

  const { error } = await supabase.from("ward_events").insert({
    event_date,
    event_time,
    title,
    location,
    notes,
    status: "published",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/ward-events");
  revalidatePath("/events");
  return { success: true };
}

export async function setWardEventStatus(id: string, status: "draft" | "published"): Promise<ActionResult> {
  const denied = await requireWardEventPlanningFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("ward_events").update({ status }).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/ward-events");
  revalidatePath("/events");
  return { success: true };
}

export async function deleteWardEvent(id: string): Promise<ActionResult> {
  const denied = await requireWardEventPlanningFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("ward_events").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/ward-events");
  revalidatePath("/events");
  return { success: true };
}