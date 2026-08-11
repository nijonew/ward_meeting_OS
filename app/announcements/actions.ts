"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { error: string };

export async function setSubmissionStatus(
  kind: "announcement" | "agenda_item",
  id: string,
  status: "published" | "archived"
): Promise<ActionResult> {
  const supabase = await createClient();
  const table = kind === "announcement" ? "announcements" : "agenda_items";

  const { error } = await supabase.from(table).update({ status }).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/announcements");
  return { success: true };
}
