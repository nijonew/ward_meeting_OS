"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateMeetingId } from "@/lib/data/meetings";
import { lookupHymn1985Title, lookupHymn1985Titles } from "@/lib/data/hymnal";
import type { ParsedMusicRow } from "@/lib/data/music-parsing";

type ActionResult = { success: true; count: number } | { error: string };

export async function submitBulkMusicRows(rows: ParsedMusicRow[]): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const validRows = rows.filter((r) => r.errors.length === 0 && r.dateIso && r.type);
  if (validRows.length === 0) {
    return { error: "No valid rows to submit." };
  }

  // Auto-fill missing titles from Music Reference (2026-09-10, the
  // user's own report: "hymn numbers... weren't submitted with
  // titles") -- the bulk paste format's title column is optional per
  // row, so a row with just a date/type/number never got a title
  // otherwise. Batched into one lookup rather than one query per row.
  const numbersNeedingTitles = validRows
    .filter((r) => r.hymnNumber != null && !r.pieceName)
    .map((r) => r.hymnNumber!);
  const titleByNumber = await lookupHymn1985Titles(numbersNeedingTitles);

  const meetingIdCache = new Map<string, string>();
  const insertRows: Record<string, unknown>[] = [];

  for (const row of validRows) {
    const meetingId = await getOrCreateMeetingId(row.dateIso!, "sacrament-meeting", meetingIdCache);
    if (!meetingId) continue;

    const pieceName = row.pieceName || (row.hymnNumber != null ? titleByNumber.get(row.hymnNumber) ?? null : null);

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
      submitted_by: user.id,
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

export async function addSingleMusicItem(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const dateIso = String(formData.get("date") ?? "");
  const type = String(formData.get("type") ?? "");

  if (!dateIso || !type) {
    return { error: "Date and type are required." };
  }

  const meetingId = await getOrCreateMeetingId(dateIso, "sacrament-meeting");

  if (!meetingId) {
    return { error: "Could not find or create that meeting." };
  }

  const hymnNumberRaw = String(formData.get("hymn_number") ?? "").trim();
  const hymnNumber = hymnNumberRaw ? Number.parseInt(hymnNumberRaw, 10) : null;
  let pieceName = String(formData.get("piece_name") ?? "").trim() || null;
  if (hymnNumber != null && !pieceName) {
    pieceName = await lookupHymn1985Title(hymnNumber);
  }

  const { error } = await supabase.from("sacrament_music").insert({
    meeting_id: meetingId,
    type,
    hymn_number: hymnNumber,
    piece_name: pieceName,
    individual_id: String(formData.get("individual_id") ?? "") || null,
    group_name: String(formData.get("group_name") ?? "").trim() || null,
    accompanist_id: String(formData.get("accompanist_id") ?? "") || null,
    status: "published",
    submitted_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/music");
  return { success: true, count: 1 };
}
