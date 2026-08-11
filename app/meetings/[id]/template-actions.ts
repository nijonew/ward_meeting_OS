"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MeetingTypeSlug } from "@/lib/types";

export async function saveTemplate(slug: MeetingTypeSlug, meetingId: string, formData: FormData) {
  const supabase = await createClient();

  const { data: meetingType } = await supabase.from("meeting_types").select("id").eq("slug", slug).single();
  if (!meetingType) {
    return { error: "Could not find that meeting type." };
  }

  const { error } = await supabase.from("meeting_type_templates").upsert(
    {
      meeting_type_id: meetingType.id,
      template_text: String(formData.get("template_text") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "meeting_type_id" }
  );

  if (error) return { error: error.message };
  revalidatePath(`/meetings/${meetingId}/template`);
  return { success: true };
}
