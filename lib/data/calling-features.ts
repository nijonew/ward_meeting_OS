import { createClient } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";
import { createCacheableClient } from "@/lib/supabase/cacheable-client";
import type { Feature } from "@/lib/supabase/get-session-user";

export interface FeatureCatalogItem {
  key: Feature;
  label: string;
}

export interface FeatureCategory {
  category: string;
  features: FeatureCatalogItem[];
}

/**
 * Fixed display order for categories -- the `features` table
 * (migration `060`) has no separate category-ordering column, only a
 * per-feature `sort_order` within its own category, so this preserves
 * the order the user actually specified the feature list in rather
 * than falling back to alphabetical (which would put "Bishopric
 * Meeting" before "Sacrament Meeting", the wrong way around).
 */
const CATEGORY_ORDER = [
  "Sacrament Meeting",
  "Bishopric Meeting",
  "Ward Council",
  "Youth Council",
  "Tools",
  "Teaching Schedules",
  "Table Admin",
];

/**
 * The full ~58-feature catalog, grouped by category in the fixed
 * display order above and sorted by each feature's own `sort_order`
 * within its category -- feeds the Calling Features checklist
 * (`/admin/calling-features`). Read-only reference data; the catalog
 * itself is edited by adding a migration, not through the app.
 *
 * **Wrapped in `unstable_cache`, 2026-11-14 pre-launch performance
 * pass** -- this table changes only when a migration adds a brand-new
 * feature, essentially never on its own, so there's no reason to
 * query it fresh every time an admin opens the Calling Features page.
 * A 5-minute cross-request cache is plenty -- a newly-added feature
 * showing up a few minutes late the first time this page is opened
 * after a migration is a non-issue. Deliberately NOT applied to
 * `getCallingFeatureKeys` below -- that one reflects which features a
 * SPECIFIC calling currently holds, which this app's own admin tools
 * change routinely, and showing a stale pre-checked state for 5
 * minutes after a real save would be a genuine correctness regression.
 */
const fetchFeatureCatalogRows = unstable_cache(
  async (): Promise<{ key: string; label: string; category: string }[]> => {
    const supabase = createCacheableClient();
    const { data, error } = await supabase
      .from("features")
      .select("key, label, category, sort_order")
      .order("sort_order");
    return error || !data ? [] : (data as { key: string; label: string; category: string }[]);
  },
  ["feature-catalog"],
  { revalidate: 300 },
);

export async function getFeatureCatalogByCategory(): Promise<FeatureCategory[]> {
  const data = await fetchFeatureCatalogRows();

  const byCategory = new Map<string, FeatureCatalogItem[]>();
  for (const row of data) {
    const list = byCategory.get(row.category) ?? [];
    list.push({ key: row.key as Feature, label: row.label });
    byCategory.set(row.category, list);
  }

  const ordered: FeatureCategory[] = [];
  for (const category of CATEGORY_ORDER) {
    const features = byCategory.get(category);
    if (features) ordered.push({ category, features });
  }
  // Any category not in the fixed list above (shouldn't happen, but a
  // future feature added without updating CATEGORY_ORDER should still
  // show up somewhere rather than silently vanishing from the page).
  for (const [category, features] of byCategory) {
    if (!CATEGORY_ORDER.includes(category)) ordered.push({ category, features });
  }

  return ordered;
}

/** Which features a specific calling currently grants -- the
 *  checklist's pre-checked state. */
export async function getCallingFeatureKeys(callingId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calling_features")
    .select("feature_key")
    .eq("calling_id", callingId);

  return error || !data ? new Set() : new Set(data.map((r) => r.feature_key as string));
}
