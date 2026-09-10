"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { FIELD_SEPARATOR } from "@/lib/data/agenda-rows";

type SaveGridActionResult = { error?: string; success?: boolean };

type RoleTable = "sacrament_assignments" | "bishopric_assignments";
type SpeakerTable = "sacrament_speakers_adults" | "sacrament_speakers_youth";

/** `sacrament_planning` columns this grid is allowed to write -- an
 *  allowlist rather than trusting whatever field name arrives, since
 *  these go straight into a column name. `special_format` is set from
 *  its own small control at the top of the page (see
 *  savePlanningInfo in app/meetings/[id]/planning/actions.ts), not
 *  this grid. */
const PLANNING_TEXT_COLUMNS = new Set(["stake_business", "recognitions"]);
/** Checkbox columns need boolean parsing, not the text allowlist's
 *  trim-or-null handling -- has_stake_business (2026-09-09) is the
 *  first of these. */
const PLANNING_BOOLEAN_COLUMNS = new Set(["has_stake_business"]);

interface MusicPatch {
  type: string;
  slot: string | null;
  number?: string;
  title?: string;
  performer?: string;
}

interface SpeakerPatch {
  table: SpeakerTable;
  slot: string;
  person?: string;
  guest?: string;
  topic?: string;
}

/**
 * Saves the whole agenda grid in one submit -- one "Save All Changes"
 * button for every element on the page, same pattern as the Assignment
 * Rotations / Teaching Calendar / Calling Planning grids, replacing the
 * old one-tiny-form-with-its-own-Save-button per element.
 *
 * Each field name encodes where its value belongs (see
 * lib/data/agenda-rows.ts, which builds them):
 *   role::<elementKey>                       -> sacrament/bishopric_assignments
 *     (chorister/organist included -- Recognize Music renders both
 *     inline, but they still write through this exact same path)
 *   note::<elementKey>::person|text          -> meeting_element_notes
 *   planning::stake_business|recognitions    -> sacrament_planning (text)
 *   planning::has_stake_business             -> sacrament_planning (boolean)
 *   music::<type>::<slot|->::number|title|performer -> sacrament_music
 *   speaker::<adults|youth>::<slot>::person|guest|topic -> sacrament_speakers_*
 *
 * Every write is scoped to exactly the fields that were submitted --
 * nothing does a blanket "delete every row for this meeting first",
 * so an element that isn't on this meeting's agenda (or a column this
 * grid doesn't own, like a speaker's duration/confirmed) is never
 * touched, let alone cleared, by a save from here.
 */
export async function saveAgendaGrid(
  meetingId: string,
  roleTable: RoleTable,
  _prevState: unknown,
  formData: FormData
): Promise<SaveGridActionResult> {
  const { user, profile } = await getSessionUser();
  if (!user) return { error: "You must be signed in." };
  // Same gate the planning page itself enforces -- re-checked here
  // rather than trusting the UI, matching every other role-gated action
  // in this app.
  if (profile?.role !== "bishopric") return { error: "Not authorized." };

  const supabase = await createClient();

  const roles = new Map<string, string>();
  const notes = new Map<string, { person?: string; text?: string }>();
  const planning = new Map<string, string>();
  const music = new Map<string, MusicPatch>();
  const speakers = new Map<string, SpeakerPatch>();

  for (const [name, rawValue] of formData.entries()) {
    const parts = name.split(FIELD_SEPARATOR);
    const value = String(rawValue).trim();

    switch (parts[0]) {
      case "role":
        if (parts.length === 2) roles.set(parts[1], value);
        break;

      case "note": {
        if (parts.length !== 3) break;
        const [, key, field] = parts;
        const entry = notes.get(key) ?? {};
        if (field === "person") entry.person = value;
        if (field === "text") entry.text = value;
        notes.set(key, entry);
        break;
      }

      case "planning":
        if (parts.length !== 2) break;
        if (PLANNING_TEXT_COLUMNS.has(parts[1]) || PLANNING_BOOLEAN_COLUMNS.has(parts[1])) {
          planning.set(parts[1], value);
        }
        break;

      case "music": {
        if (parts.length !== 4) break;
        const [, type, slotKey, field] = parts;
        const mapKey = `${type}${FIELD_SEPARATOR}${slotKey}`;
        const entry = music.get(mapKey) ?? { type, slot: slotKey === "-" ? null : slotKey };
        if (field === "number") entry.number = value;
        if (field === "title") entry.title = value;
        if (field === "performer") entry.performer = value;
        music.set(mapKey, entry);
        break;
      }

      case "speaker": {
        if (parts.length !== 4) break;
        const [, variant, slot, field] = parts;
        const table: SpeakerTable =
          variant === "youth" ? "sacrament_speakers_youth" : "sacrament_speakers_adults";
        const mapKey = `${table}${FIELD_SEPARATOR}${slot}`;
        const entry = speakers.get(mapKey) ?? { table, slot };
        if (field === "person") entry.person = value;
        if (field === "guest") entry.guest = value;
        if (field === "topic") entry.topic = value;
        speakers.set(mapKey, entry);
        break;
      }

      default:
        break;
    }
  }

  // --- person_role elements -------------------------------------------
  for (const [role, personId] of roles) {
    const { error: deleteError } = await supabase
      .from(roleTable)
      .delete()
      .eq("meeting_id", meetingId)
      .eq("role", role);
    if (deleteError) return { error: deleteError.message };

    if (personId) {
      const { error } = await supabase
        .from(roleTable)
        .insert({ meeting_id: meetingId, role, assigned_to_id: personId });
      if (error) return { error: error.message };
    }
  }

  // --- free_text / person_and_text elements ----------------------------
  for (const [key, entry] of notes) {
    const personId = entry.person || null;
    const textValue = entry.text || null;

    if (!personId && !textValue) {
      // Nothing left in this element -- drop the row rather than leaving
      // an all-null one behind (meeting_element_notes is a sparse table:
      // no row simply means nothing was entered).
      const { error } = await supabase
        .from("meeting_element_notes")
        .delete()
        .eq("meeting_id", meetingId)
        .eq("element_key", key);
      if (error) return { error: error.message };
      continue;
    }

    const { error } = await supabase.from("meeting_element_notes").upsert(
      {
        meeting_id: meetingId,
        element_key: key,
        person_id: personId,
        text_value: textValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "meeting_id,element_key" }
    );
    if (error) return { error: error.message };
  }

  // --- sacrament_planning columns ---------------------------------------
  if (planning.size > 0) {
    const payload: Record<string, unknown> = { meeting_id: meetingId, updated_at: new Date().toISOString() };
    for (const [column, value] of planning) {
      payload[column] = PLANNING_BOOLEAN_COLUMNS.has(column) ? value === "on" : value || null;
    }

    // Only the submitted columns are in the payload, so special_format
    // and hidden_notes keep whatever they already had.
    const { error } = await supabase.from("sacrament_planning").upsert(payload, { onConflict: "meeting_id" });
    if (error) return { error: error.message };
  }

  // --- music -----------------------------------------------------------
  for (const patch of music.values()) {
    const hymnNumber = patch.number ? Number.parseInt(patch.number, 10) : null;
    const pieceName = patch.title || null;
    const performer = patch.performer || null;
    const isEmpty = hymnNumber == null && !pieceName && !performer;

    // A singleton hymn type (slot null) matches on type alone -- only one
    // of each ever exists per meeting, and older rows may carry a stray
    // slot value from before this grid assigned them positionally.
    let query = supabase.from("sacrament_music").select("id").eq("meeting_id", meetingId).eq("type", patch.type);
    query = patch.slot === null ? query : query.eq("slot", patch.slot);
    const { data: existingRows, error: lookupError } = await query.limit(1);
    if (lookupError) return { error: lookupError.message };
    const existingId = (existingRows as { id: string }[] | null)?.[0]?.id ?? null;

    if (isEmpty) {
      if (existingId) {
        const { error } = await supabase.from("sacrament_music").delete().eq("id", existingId);
        if (error) return { error: error.message };
      }
      continue;
    }

    if (existingId) {
      const { error } = await supabase
        .from("sacrament_music")
        .update({ hymn_number: hymnNumber, piece_name: pieceName, group_name: performer })
        .eq("id", existingId);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("sacrament_music").insert({
        meeting_id: meetingId,
        type: patch.type,
        slot: patch.slot,
        hymn_number: hymnNumber,
        piece_name: pieceName,
        group_name: performer,
        status: "published",
        submitted_by: user.id,
      });
      if (error) return { error: error.message };
    }
  }

  // --- speakers ---------------------------------------------------------
  for (const patch of speakers.values()) {
    const speakerId = patch.person || null;
    const guestName = patch.guest || null;
    const topic = patch.topic || null;
    const isEmpty = !speakerId && !guestName && !topic;

    const { data: existingRows, error: lookupError } = await supabase
      .from(patch.table)
      .select("id")
      .eq("meeting_id", meetingId)
      .eq("slot", patch.slot)
      .limit(1);
    if (lookupError) return { error: lookupError.message };
    const existingId = (existingRows as { id: string }[] | null)?.[0]?.id ?? null;

    if (isEmpty) {
      if (existingId) {
        const { error } = await supabase.from(patch.table).delete().eq("id", existingId);
        if (error) return { error: error.message };
      }
      continue;
    }

    // Update rather than delete-and-reinsert so duration/confirmed --
    // columns this grid doesn't show -- survive a save from here.
    if (existingId) {
      const { error } = await supabase
        .from(patch.table)
        .update({ speaker_id: speakerId, guest_speaker_name: guestName, topic })
        .eq("id", existingId);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from(patch.table).insert({
        meeting_id: meetingId,
        slot: patch.slot,
        speaker_id: speakerId,
        guest_speaker_name: guestName,
        topic,
      });
      if (error) return { error: error.message };
    }
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}
