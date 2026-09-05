"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ParsedMusicRow } from "@/lib/data/music-parsing";

type ActionResult = { success: true; count: number } | { error: string };

/**
 * Finds the Sacrament Meeting for a given date, or creates one (stage
 * 'template') if it doesn't exist yet -- so bulk music entry can run far
 * ahead of the meetings themselves being individually created.
 */
async function getOrCreateSacramentMeetingId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dateIso: string,
  cache: Map<string, string>
): Promise<string | null> {
  if (cache.has(dateIso)) {
    return cache.get(dateIso)!;
  }

  const { data: existing } = await supabase
    .from("meetings")
    .select("id, meeting_types!inner(slug)")
    .eq("date", dateIso)
    .eq("meeting_types.slug", "sacrament-meeting")
    .maybeSingle();

  if (existing) {
    cache.set(dateIso, existing.id as string);
    return existing.id as string;
  }

  const { data: meetingType } = await supabase
    .from("meeting_types")
    .select("id")
    .eq("slug", "sacrament-meeting")
    .single();

  if (!meetingType) {
    return null;
  }

  const { data: created, error } = await supabase
    .from("meetings")
    .insert({ meeting_type_id: meetingType.id, date: dateIso, stage: "template" })
    .select("id")
    .single();

  if (error || !created) {
    return null;
  }

  cache.set(dateIso, created.id as string);
  return created.id as string;
}

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

  const meetingIdCache = new Map<string, string>();
  const insertRows: Record<string, unknown>[] = [];

  for (const row of validRows) {
    const meetingId = await getOrCreateSacramentMeetingId(supabase, row.dateIso!, meetingIdCache);
    if (!meetingId) continue;

    insertRows.push({
      meeting_id: meetingId,
      type: row.type,
      hymn_number: row.hymnNumber,
      piece_name: row.pieceName,
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

  const meetingIdCache = new Map<string, string>();
  const meetingId = await getOrCreateSacramentMeetingId(supabase, dateIso, meetingIdCache);

  if (!meetingId) {
    return { error: "Could not find or create that meeting." };
  }

  const hymnNumberRaw = String(formData.get("hymn_number") ?? "").trim();

  const { error } = await supabase.from("sacrament_music").insert({
    meeting_id: meetingId,
    type,
    hymn_number: hymnNumberRaw ? Number.parseInt(hymnNumberRaw, 10) : null,
    piece_name: String(formData.get("piece_name") ?? "").trim() || null,
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
