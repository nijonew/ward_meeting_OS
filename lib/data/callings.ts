import { createClient } from "@/lib/supabase/server";

export interface CallingOption {
  id: string;
  name: string;
}

export async function getActiveCallings(): Promise<CallingOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("callings")
    .select("id, name")
    .eq("active", true)
    .order("sort_order");

  return error || !data ? [] : data;
}
