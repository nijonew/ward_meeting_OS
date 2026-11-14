import { unstable_cache } from "next/cache";
import { createCacheableClient } from "@/lib/supabase/cacheable-client";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * The actual DB read, wrapped in `unstable_cache` (2026-11-14
 * pre-launch performance pass) -- this table is admin-maintained
 * reference data (dropdown option lists), changed only through
 * `/admin/admin_select_options`, not something any ordinary page
 * write ever touches, so a 5-minute cross-request cache is safe. The
 * cache key is `["admin-select-options", fieldKey]` -- `unstable_cache`
 * folds the function's own arguments into its cache key automatically,
 * so each field key gets its own independent cache entry.
 */
const fetchSelectOptionRows = unstable_cache(
  async (fieldKey: string): Promise<SelectOption[] | null> => {
    const supabase = createCacheableClient();
    const { data } = await supabase
      .from("admin_select_options")
      .select("value, label")
      .eq("field_key", fieldKey)
      .order("sort_order", { ascending: true });
    return data && data.length > 0 ? (data as SelectOption[]) : null;
  },
  ["admin-select-options"],
  { revalidate: 300 },
);

/**
 * Reads an admin-editable option list for one field (e.g.
 * "calling_planning.calling_status") from admin_select_options, ordered
 * by sort_order -- see 022_admin_select_options.sql. Falls back to
 * `fallback` if the table has no rows for that field key yet, so a
 * field never ends up with zero choices (before the seed migration has
 * run, or if every row for it was deleted). `fallback` is kept outside
 * the cached fetch itself so a caller passing a different fallback for
 * the same field key doesn't fragment the cache for no reason.
 *
 * Shared by the real feature page (e.g. CallingPlanningGridForm) and the
 * generic Table Admin grid (lib/admin/table-data.ts), so both read the
 * same admin-managed list rather than the grid having its own copy.
 */
export async function getSelectOptions(fieldKey: string, fallback: SelectOption[]): Promise<SelectOption[]> {
  const rows = await fetchSelectOptionRows(fieldKey);
  return rows ?? fallback;
}
