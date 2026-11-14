"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getAccessibleClasses } from "@/lib/data/teaching-assignments";

type SaveGridActionResult = { error?: string; success?: boolean };

/** Grid field names are "<classDate>::teacher"/"<classDate>::topic" so
 *  one <form> can carry every row's two fields at once, same convention
 *  as the Assignment Rotations grid (parseGridFieldName in
 *  app/rotations/actions.ts). ":" never appears in an ISO date, so this
 *  can't collide/misparse. */
function parseFieldName(name: string): { classDate: string; field: "teacher" | "topic" } | null {
  const idx = name.indexOf("::");
  if (idx === -1) return null;
  const field = name.slice(idx + 2);
  if (field !== "teacher" && field !== "topic") return null;
  return { classDate: name.slice(0, idx), field };
}

/**
 * Saves every row on one class's grid in one submit, same "one Save All
 * Changes button" pattern as saveAssignmentGrid (app/rotations/actions.ts)
 * and the same delete-then-insert-if-set approach as every other
 * per-cell save in this app -- a row with neither field filled in just
 * means no row for that date exists.
 *
 * Shared by both Youth Teaching Planning and the Elders Quorum/Relief
 * Society page -- the underlying save mechanism is identical either
 * way; both resolve access through the one unified, calling-based
 * `getAccessibleClasses` (2026-11-14, see that function's own doc
 * comment) rather than branching on adult vs. youth.
 */
export async function saveTeachingGrid(_prevState: unknown, formData: FormData): Promise<SaveGridActionResult> {
  const { user, profile } = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  const className = String(formData.get("class_name") ?? "").trim();
  if (!className) return { error: "Missing class." };

  const accessibleClasses = await getAccessibleClasses(user.id, profile?.features);
  // Re-checks class-level access server-side -- the grid this submits
  // from only ever renders fields for a class the viewer was already
  // confirmed to have access to on the page itself, so a mismatch here
  // can only happen against a forged/direct request, not a legitimate
  // user.
  if (!accessibleClasses.includes(className)) return { error: "Not authorized for that class." };

  const byDate = new Map<string, { teacher: string; topic: string }>();
  for (const [name, value] of formData.entries()) {
    const parsed = parseFieldName(name);
    if (!parsed) continue;
    const entry = byDate.get(parsed.classDate) ?? { teacher: "", topic: "" };
    entry[parsed.field] = String(value).trim();
    byDate.set(parsed.classDate, entry);
  }

  const supabase = await createClient();

  for (const [classDate, { teacher, topic }] of byDate) {
    const { error: deleteError } = await supabase
      .from("teaching_assignments")
      .delete()
      .eq("class_date", classDate)
      .eq("class_name", className);
    if (deleteError) return { error: deleteError.message };

    if (teacher || topic) {
      const { error: insertError } = await supabase.from("teaching_assignments").insert({
        class_date: classDate,
        class_name: className,
        teacher_name: teacher || null,
        topic: topic || null,
      });
      if (insertError) return { error: insertError.message };
    }
  }

  revalidatePath("/youth-teaching-planning");
  revalidatePath("/adult-teaching-planning");
  return { success: true };
}
