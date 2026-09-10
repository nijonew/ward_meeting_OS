"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getAccessibleClasses } from "@/lib/data/teaching-assignments";

type SaveGridActionResult = { error?: string; success?: boolean };

/** Grid field names are "<classDate>::<className>" so one <form> can
 *  carry every cell at once, same convention as the Assignment
 *  Rotations grid (parseGridFieldName in app/rotations/actions.ts). ":"
 *  never appears in an ISO date or a class name, so this can't
 *  collide/misparse. */
function parseFieldName(name: string): { classDate: string; className: string } | null {
  const idx = name.indexOf("::");
  if (idx === -1) return null;
  return { classDate: name.slice(0, idx), className: name.slice(idx + 2) };
}

/**
 * Saves every cell on the grid in one submit, same "one Save All
 * Changes button" pattern as saveAssignmentGrid (app/rotations/actions.ts)
 * and the same delete-then-insert-if-set approach as every other
 * per-cell save in this app -- a blank cell just means no row for that
 * (date, class) exists.
 *
 * Re-checks class-level access server-side (2026-09-09, added alongside
 * the youth_class_teachers access-control rework) -- the grid this
 * submits from only ever renders fields for the one class the viewer
 * was already confirmed to have access to on the page itself, so a
 * mismatch here can only happen against a forged/direct request, not a
 * legitimate user; skipped silently rather than erroring the whole
 * save, same way a mismatched meeting type is a non-issue for a
 * legitimate caller of submitAgendaItem.
 */
export async function saveTeachingGrid(_prevState: unknown, formData: FormData): Promise<SaveGridActionResult> {
  const { user, profile } = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  const accessibleClasses = await getAccessibleClasses(user.id, profile?.role ?? null);

  const supabase = await createClient();

  for (const [name, value] of formData.entries()) {
    const parsed = parseFieldName(name);
    if (!parsed) continue;
    if (!accessibleClasses.includes(parsed.className)) continue;
    const entry = String(value).trim();

    const { error: deleteError } = await supabase
      .from("teaching_assignments")
      .delete()
      .eq("class_date", parsed.classDate)
      .eq("class_name", parsed.className);
    if (deleteError) return { error: deleteError.message };

    if (entry) {
      const { error: insertError } = await supabase
        .from("teaching_assignments")
        .insert({ class_date: parsed.classDate, class_name: parsed.className, entry });
      if (insertError) return { error: insertError.message };
    }
  }

  revalidatePath("/youth-teaching-planning");
  return { success: true };
}
