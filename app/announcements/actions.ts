"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };

// Had no server-side check at all before this (2026-10-04, found while
// converting the page's own gate to the granular-features model) --
// only the page's own gate kept this inbox's controls out of a
// non-admin's view.
export async function setSubmissionStatus(
  kind: "announcement" | "agenda_item",
  id: string,
  status: "published" | "archived"
): Promise<ActionResult> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "announcement_management")) return { error: "Not authorized." };

  const supabase = await createClient();
  const table = kind === "announcement" ? "announcements" : "agenda_items";

  const { error } = await supabase.from(table).update({ status }).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/announcements");
  return { success: true };
}
