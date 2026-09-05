import { createClient } from "@/lib/supabase/server";
import { personName } from "@/lib/data/calling-planning";

export interface CallingOption {
  id: string;
  name: string;
}

export interface CallingListItem {
  id: string;
  name: string;
  title_prefix: string | null;
  current_holder_name: string | null;
  active: boolean;
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

export async function getAllCallings(): Promise<CallingListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("callings")
    .select("id, name, title_prefix, active, people:current_holder_id(name)")
    .order("sort_order");

  if (error || !data) return [];

  return (data as unknown[]).map((row) => {
    const r = row as {
      id: string;
      name: string;
      title_prefix: string | null;
      active: boolean;
      people: unknown;
    };

    return {
      id: r.id,
      name: r.name,
      title_prefix: r.title_prefix,
      current_holder_name: personName(r.people),
      active: r.active,
    };
  });
}
