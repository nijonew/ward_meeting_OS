"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Moved here from lib/data/council-notes.ts, 2026-11-01 -- see that
// file's own comment for why (CouncilNotesForm.tsx became a Client
// Component for the Planning page's combined "Save All Changes"
// button, and a per-function inline "use server" directive only works
// when the importing module is part of the server tree). Widened to a
// non-strict return shape rather than a true discriminated union, same
// reasoning as saveBishopricMinutes's own identical note -- useActionState's
// `initialState` ({}) must be assignable to this function's return type.
export async function saveCouncilNotes(
  meetingId: string,
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();

  const { error } = await supabase.from("council_notes").upsert(
    {
      meeting_id: meetingId,
      notes: String(formData.get("notes") ?? "").trim() || null,
      next_meeting_date: String(formData.get("next_meeting_date") ?? "") || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id" }
  );

  if (error) return { error: error.message };
  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}
