import { createClient } from "@/lib/supabase/server";

export interface MeetingTypeOption {
  id: string;
  name: string;
  slug: string;
}

export async function getMeetingTypes(): Promise<MeetingTypeOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("meeting_types").select("id, name, slug").order("name");
  return (data ?? []) as MeetingTypeOption[];
}