import { createClient } from "@/lib/supabase/server";

export interface CallingListRow {
  id: string;
  name: string;
  title_prefix: string | null;
  current_holder_name: string | null;
  active: boolean;
  planning_status: string | null; // latest calling_planning.calling_status, if any
}

export async function getAllCallings(): Promise<CallingListRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("callings")
    .select(
      "id, name, title_prefix, active, people:current_holder_id(name), calling_planning(calling_status, created_at)"
    )
    .order("sort_order");

  if (error || !data) return [];

  return (data as unknown[]).map((row) => {
    const r = row as {
      id: string;
      name: string;
      title_prefix: string | null;
      active: boolean;
      people: { name?: string }[] | { name?: string } | null;
      calling_planning: { calling_status: string; created_at: string }[] | null;
    };
    const holder = Array.isArray(r.people) ? r.people[0] : r.people;
    const latestPlanning = (r.calling_planning ?? []).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    )[0];

    return {
      id: r.id,
      name: r.name,
      title_prefix: r.title_prefix,
      current_holder_name: holder?.name ?? null,
      active: r.active,
      planning_status: latestPlanning?.calling_status ?? null,
    };
  });
}
