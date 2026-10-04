import { createClient } from "@/lib/supabase/server";
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
  "Table Admin",
];

/**
 * The full ~58-feature catalog, grouped by category in the fixed
 * display order above and sorted by each feature's own `sort_order`
 * within its category -- feeds the Calling Features checklist
 * (`/admin/calling-features`). Read-only reference data; the catalog
 * itself is edited by adding a migration, not through the app.
 */
export async function getFeatureCatalogByCategory(): Promise<FeatureCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("features")
    .select("key, label, category, sort_order")
    .order("sort_order");

  if (error || !data) return [];

  const byCategory = new Map<string, FeatureCatalogItem[]>();
  for (const row of data as { key: string; label: string; category: string }[]) {
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
