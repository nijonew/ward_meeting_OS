import { createClient } from "@/lib/supabase/server";
import type { AdminTableConfig } from "./types";

export type AdminRow = Record<string, unknown> & { id: string };
type MutationResult = { success: true } | { error: string };

export async function getAdminRows(config: AdminTableConfig): Promise<AdminRow[]> {
  const supabase = await createClient();
  const columns = ["id", ...config.columns.map((c) => c.column)].join(", ");
  const query = supabase.from(config.table).select(columns);
  const { data, error } = config.orderBy
    ? await query.order(config.orderBy.column, { ascending: config.orderBy.ascending ?? true })
    : await query;

  if (error || !data) return [];
  return data as unknown as AdminRow[];
}

export async function getForeignKeyOptions(
  table: string,
  valueColumn: string,
  labelColumn: string
): Promise<{ value: string; label: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(table)
    .select(`${valueColumn}, ${labelColumn}`)
    .order(labelColumn);

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    value: String(row[valueColumn]),
    label: String(row[labelColumn] ?? ""),
  }));
}

/**
 * Strips an incoming patch down to only columns declared in the config.
 * This is the actual security boundary for the generic editor: even if a
 * caller (or a tampered client request) sends extra fields, anything not
 * explicitly listed in the table's AdminTableConfig -- id, timestamps,
 * app-invariant columns like rotations.next_index -- never reaches the
 * update/insert call.
 */
function sanitizePatch(config: AdminTableConfig, patch: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(config.columns.map((c) => c.column));
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (allowed.has(key)) clean[key] = value === "" ? null : value;
  }
  return clean;
}

export async function updateAdminRow(
  config: AdminTableConfig,
  id: string,
  patch: Record<string, unknown>
): Promise<MutationResult> {
  const supabase = await createClient();
  const { error } = await supabase.from(config.table).update(sanitizePatch(config, patch)).eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function insertAdminRow(
  config: AdminTableConfig,
  patch: Record<string, unknown>
): Promise<MutationResult> {
  const supabase = await createClient();
  const { error } = await supabase.from(config.table).insert(sanitizePatch(config, patch));
  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteAdminRow(config: AdminTableConfig, id: string): Promise<MutationResult> {
  const supabase = await createClient();
  const { error } = await supabase.from(config.table).delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}
