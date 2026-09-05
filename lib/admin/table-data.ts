import { createClient } from "@/lib/supabase/server";
import type { AdminOption, AdminTableConfig } from "./types";

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
): Promise<AdminOption[]> {
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
 * Same idea as getForeignKeyOptions, but specifically for a "Meeting"
 * lookup: renders as a calendar (MeetingDatePicker), not a dropdown, so
 * every option carries its raw `date` for grouping onto the calendar
 * grid, and the label adds the meeting type name so two meetings on the
 * same date (different types) are still distinguishable if they ever
 * show up in the same unscoped list. meetingTypeSlug narrows the list to
 * one meeting type -- most tables that reference "a meeting" only ever
 * mean one specific type of it (e.g. every sacrament_* table means
 * Sacrament Meeting), so this also naturally rules out picking the wrong
 * meeting's date entirely, rather than just labeling it better.
 */
export async function getMeetingFkOptions(meetingTypeSlug?: string): Promise<AdminOption[]> {
  const supabase = await createClient();
  let query = supabase.from("meetings").select("id, date, meeting_types!inner(name, slug)").order("date", { ascending: false });
  if (meetingTypeSlug) query = query.eq("meeting_types.slug", meetingTypeSlug);
  const { data } = await query;

  return ((data ?? []) as unknown as {
    id: string;
    date: string;
    meeting_types: { name?: string; slug?: string }[] | { name?: string; slug?: string } | null;
  }[]).map((row) => {
    const meetingType = Array.isArray(row.meeting_types) ? row.meeting_types[0] : row.meeting_types;
    const formattedDate = new Date(`${row.date}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const label = meetingTypeSlug ? formattedDate : `${formattedDate} — ${meetingType?.name ?? "Meeting"}`;
    return { value: row.id, label, date: row.date };
  });
}

/**
 * For every column with `scopedBy`, computes a per-row-scope-value option
 * list: e.g. for calling_planning.release_person_id (scoped by calling_id,
 * looking up callings.current_holder_id/backup_holder_id), this returns
 * { release_person_id: { "<calling-1-id>": [holder, backup], ... } } so
 * each row can be narrowed to just its own calling's people.
 */
export async function getScopedFkOptions(
  config: AdminTableConfig,
  rows: AdminRow[]
): Promise<Record<string, Record<string, AdminOption[]>>> {
  const supabase = await createClient();
  const result: Record<string, Record<string, AdminOption[]>> = {};

  for (const col of config.columns) {
    if (!col.scopedBy || !col.foreignKey) continue;
    const { scopeColumn, lookupTable, lookupColumns } = col.scopedBy;
    const fk = col.foreignKey;

    const scopeValues = Array.from(
      new Set(rows.map((r) => r[scopeColumn]).filter((v): v is string => typeof v === "string"))
    );
    if (scopeValues.length === 0) {
      result[col.column] = {};
      continue;
    }

    const { data: lookupRows } = await supabase
      .from(lookupTable)
      .select(["id", ...lookupColumns].join(", "))
      .in("id", scopeValues);
    const typedLookupRows = (lookupRows ?? []) as unknown as Record<string, unknown>[];

    const targetIds = new Set<string>();
    for (const row of typedLookupRows) {
      for (const lc of lookupColumns) {
        const v = row[lc];
        if (typeof v === "string") targetIds.add(v);
      }
    }

    let labelsById = new Map<string, string>();
    if (targetIds.size > 0) {
      const { data: targetRows } = await supabase
        .from(fk.table)
        .select(`${fk.valueColumn}, ${fk.labelColumn}`)
        .in(fk.valueColumn, Array.from(targetIds));
      labelsById = new Map(
        ((targetRows ?? []) as unknown as Record<string, unknown>[]).map((r) => [
          String(r[fk.valueColumn]),
          String(r[fk.labelColumn] ?? ""),
        ])
      );
    }

    const byScope: Record<string, AdminOption[]> = {};
    for (const row of typedLookupRows) {
      const options: AdminOption[] = [];
      for (const lc of lookupColumns) {
        const targetId = row[lc];
        if (typeof targetId === "string" && labelsById.has(targetId)) {
          options.push({ value: targetId, label: labelsById.get(targetId)! });
        }
      }
      byScope[String(row.id)] = options;
    }
    result[col.column] = byScope;
  }

  return result;
}

/**
 * Strips an incoming patch down to only columns declared in the config.
 * This is the actual security boundary for the generic editor: even if a
 * caller (or a tampered client request) sends extra fields, anything not
 * explicitly listed in the table's AdminTableConfig -- id, timestamps,
 * app-invariant columns like rotations.next_index -- never reaches the
 * update/insert call.
 *
 * Empty string is only converted to null for non-text types: a select,
 * foreign key, date, time, or number column can't take "" as a real
 * value, but a NOT NULL text column (e.g. announcements.submitted_by_email)
 * can and should -- forcing it to null there would just turn an optional
 * field into a write that fails the column's own constraint.
 */
function sanitizePatch(config: AdminTableConfig, patch: Record<string, unknown>): Record<string, unknown> {
  const columnConfigs = new Map(config.columns.map((c) => [c.column, c]));
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const colConfig = columnConfigs.get(key);
    if (!colConfig) continue;
    const isTextType = colConfig.type === "text" || colConfig.type === "long_text";
    clean[key] = value === "" && !isTextType ? null : value;
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
