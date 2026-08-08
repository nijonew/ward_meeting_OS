import { createClient } from "@/lib/supabase/server";
import type { MeetingTypeSlug } from "@/lib/types";

export async function getTemplateBySlug(slug: MeetingTypeSlug): Promise<string | null> {
  const supabase = await createClient();

  const { data: meetingType } = await supabase
    .from("meeting_types")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!meetingType) return null;

  const { data } = await supabase
    .from("meeting_type_templates")
    .select("template_text")
    .eq("meeting_type_id", meetingType.id)
    .maybeSingle();

  return data?.template_text ?? null;
}
