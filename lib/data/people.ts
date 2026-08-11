import { createClient } from "@/lib/supabase/server";

export interface PersonOption {
  id: string;
  name: string;
}

export async function getActivePeople(): Promise<PersonOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, name")
    .eq("active", true)
    .order("name");

  return error || !data ? [] : data;
}
