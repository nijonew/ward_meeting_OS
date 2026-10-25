"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getAdminTableConfig } from "@/lib/admin/registry";
import { updateAdminRow, insertAdminRow, deleteAdminRow } from "@/lib/admin/table-data";
import { getOrCreateMeetingId } from "@/lib/data/meetings";
import { lookupHymnTitles } from "@/lib/data/hymnal";
import type { ParsedMusicRow } from "@/lib/data/music-parsing";

type ActionResult = { success: true; count: number } | { error: string };
type GridActionResult = { success: true } | { error: string };

/** Both the bulk-paste tool and the grid below share this one gate --
 *  re-checked here server-side, not just by the page's own gate,
 *  matching every other feature-gated action in this app. Found
 *  missing entirely on `submitBulkMusicRows`/the now-removed single-add
 *  form while building the grid (2026-10-24) -- neither had ever
 *  checked anything beyond "is someone signed in." */
async function requireMusicFeature(): Promise<{ userId: string } | { error: string }> {
  const { user, profile } = await getSessionUser();
  if (!user) return { error: "You must be signed in." };
  if (!hasFeature(profile, "sacrament_music")) return { error: "Not authorized." };
  return { userId: user.id };
}

/**
 * The grid itself (2026-10-24, the user's own request: "I want someone
 * entering music to be able to do it much like the page
 * .../admin/sacrament_music"). Reuses the exact same `AdminTableEditor`
 * component and `sacrament_music` registry column config Table Admin's
 * own `/admin/sacrament_music` renders -- full inline edit/add/delete,
 * not just bulk-paste-then-review -- but gated on `sacrament_music`
 * (the Music planner feature), not `table_admin_sacrament_music`, same
 * split `app/announcements/actions.ts` already established for Manage
 * Announcements vs. raw Table Admin access.
 */
export async function updateMusicRow(table: string, id: string, patch: Record<string, unknown>): Promise<GridActionResult> {
  const auth = await requireMusicFeature();
  if (!("userId" in auth)) return auth;
  const config = getAdminTableConfig("sacrament_music");
  if (!config) return { error: "Unknown table." };
  const result = await updateAdminRow(config, id, patch);
  if ("success" in result) revalidatePath("/music");
  return result;
}

export async function insertMusicRow(table: string, patch: Record<string, unknown>): Promise<GridActionResult> {
  const auth = await requireMusicFeature();
  if (!("userId" in auth)) return auth;
  const config = getAdminTableConfig("sacrament_music");
  if (!config) return { error: "Unknown table." };
  const result = await insertAdminRow(config, patch);
  if ("success" in result) revalidatePath("/music");
  return result;
}

export async function deleteMusicRow(table: string, id: string): Promise<GridActionResult> {
  const auth = await requireMusicFeature();
  if (!("userId" in auth)) return auth;
  const config = getAdminTableConfig("sacrament_music");
  if (!config) return { error: "Unknown table." };
  const result = await deleteAdminRow(config, id);
  if ("success" in result) revalidatePath("/music");
  return result;
}

export async function submitBulkMusicRows(rows: ParsedMusicRow[]): Promise<ActionResult> {
  const auth = await requireMusicFeature();
  if (!("userId" in auth)) return auth;
  const supabase = await createClient();

  const validRows = rows.filter((r) => r.errors.length === 0 && r.dateIso && r.type);
  if (validRows.length === 0) {
    return { error: "No valid rows to submit." };
  }

  // Auto-fill missing titles from Music Reference (2026-09-10, the
  // user's own report: "hymn numbers... weren't submitted with
  // titles") -- the bulk paste format's title column is optional per
  // row, so a row with just a date/type/number never got a title
  // otherwise. Batched into one lookup rather than one query per row.
  // hymn_number is a free-text identifier (migration 051) -- "C20"
  // means Children's Songbook #20, anything else matches across the
  // 1985 Hymnal and Hymns for Home and Church (2026-10-03).
  const numbersNeedingTitles = validRows
    .filter((r) => r.hymnNumber && !r.pieceName)
    .map((r) => r.hymnNumber!);
  const titleByNumber = await lookupHymnTitles(numbersNeedingTitles);

  const meetingIdCache = new Map<string, string>();
  const insertRows: Record<string, unknown>[] = [];

  for (const row of validRows) {
    const meetingId = await getOrCreateMeetingId(row.dateIso!, "sacrament-meeting", meetingIdCache);
    if (!meetingId) continue;

    const pieceName = row.pieceName || (row.hymnNumber ? titleByNumber.get(row.hymnNumber) ?? null : null);

    insertRows.push({
      meeting_id: meetingId,
      type: row.type,
      hymn_number: row.hymnNumber,
      piece_name: pieceName,
      individual_id: row.matchedIndividualId,
      // Fall back to storing unmatched performer text (or an explicit
      // group name) in group_name -- there's no separate "guest performer"
      // text column on this table.
      group_name: row.groupName || (row.matchedIndividualId ? null : row.performerText),
      accompanist_id: row.matchedAccompanistId,
      status: "published",
      submitted_by: auth.userId,
    });
  }

  if (insertRows.length === 0) {
    return { error: "Could not resolve meetings for any rows." };
  }

  const { error } = await supabase.from("sacrament_music").insert(insertRows);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/music");
  return { success: true, count: insertRows.length };
}
