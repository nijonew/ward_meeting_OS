import { createClient } from "@/lib/supabase/server";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Reads an admin-editable option list for one field (e.g.
 * "calling_planning.calling_status") from admin_select_options, ordered
 * by sort_order -- see 022_admin_select_options.sql. Falls back to
 * `fallback` if the table has no rows for that field key yet, so a
 * field never ends up with zero choices (before the seed migration has
 * run, or if every row for it was deleted).
 *
 * Shared by the real feature page (e.g. CallingPlanningCard) and the
 * generic Table Admin grid (lib/admin/table-data.ts), so both read the
 * same admin-managed list rather than the grid having its own copy.
 */
export async function getSelectOptions(fieldKey: string, fallback: SelectOption[]): Promise<SelectOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_select_options")
    .select("value, label")
    .eq("field_key", fieldKey)
    .order("sort_order", { ascending: true });

  if (!data || data.length === 0) return fallback;
  return data as SelectOption[];
}
