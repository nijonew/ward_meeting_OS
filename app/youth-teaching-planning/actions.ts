"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getAccessibleClasses, ADULT_TEACHING_CLASSES } from "@/lib/data/teaching-assignments";

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
 * Shared by both Youth Teaching Planning (per-class, access-controlled
 * via youth_class_teachers) and the Elders Quorum/Relief Society page
 * (adult_teaching_planning feature, no per-class restriction) -- the
 * underlying save mechanism is identical either way, only which gate
 * applies depends on whether the submitted class_name is a youth class
 * or one of the two adult ones.
 */
export async function saveTeachingGrid(_prevState: unknown, formData: FormData): Promise<SaveGridActionResult> {
  const { user, profile } = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  const className = String(formData.get("class_name") ?? "").trim();
  if (!className) return { error: "Missing class." };

  const isAdultClass = (ADULT_TEACHING_CLASSES as readonly string[]).includes(className);
  if (isAdultClass) {
    if (!hasFeature(profile, "adult_teaching_planning")) return { error: "Not authorized." };
  } else {
    if (!hasFeature(profile, "youth_teaching_planning")) return { error: "Not authorized." };
    const accessibleClasses = await getAccessibleClasses(user.id);
    // Re-checks class-level access server-side (2026-09-09, added
    // alongside the youth_class_teachers access-control rework) -- the
    // grid this submits from only ever renders fields for the one class
    // the viewer was already confirmed to have access to on the page
    // itself, so a mismatch here can only happen against a forged/direct
    // request, not a legitimate user.
    if (!accessibleClasses.includes(className)) return { error: "Not authorized for that class." };
  }

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
