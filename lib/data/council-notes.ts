import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface CouncilNotes {
  notes: string | null;
  next_meeting_date: string | null;
}

export async function getCouncilNotes(meetingId: string): Promise<CouncilNotes | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("council_notes")
    .select("notes, next_meeting_date")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  return data ?? null;
}

export async function saveCouncilNotes(meetingId: string, formData: FormData) {
  "use server";
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