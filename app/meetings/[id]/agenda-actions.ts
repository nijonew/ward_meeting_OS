"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { FIELD_SEPARATOR } from "@/lib/data/agenda-rows";
import { lookupHymnTitles } from "@/lib/data/hymnal";
import { getMeetingById } from "@/lib/data/meetings";
import { meetingFeature } from "@/lib/data/meeting-features";

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
 *  trim-or-null handling -- has_stake_business (2026-09-09) was the
 *  first of these; ready_for_public (2026-10-04, the "ready for
 *  public viewing" checkbox at the bottom of the closing grid half,
 *  reworded from "public consumption" 2026-10-11) is the second. */
const PLANNING_BOOLEAN_COLUMNS = new Set(["has_stake_business", "ready_for_public"]);

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
 *   role::<elementKey>                        -> sacrament/bishopric_assignments
 *   role::<elementKey>::person_id|guest_name  -> sacrament_assignments
 *     (chorister/organist specifically -- Recognize Music renders both
 *     inline with their own guest option, 2026-10-07, same two-part
 *     shape as speaker::.../visiting_authority::... below. Every other
 *     person_role element still uses the bare one-part form above.)
 *   note::<elementKey>::person|text          -> meeting_element_notes
 *   planning::stake_business|recognitions    -> sacrament_planning (text)
 *   planning::has_stake_business|ready_for_public -> sacrament_planning (boolean)
 *   music::<type>::<slot|->::number|title|performer -> sacrament_music
 *   speaker::<adults|youth>::<slot>::person|guest|topic -> sacrament_speakers_*
 *   visiting_authority::<n>::person_id|guest_name -> sacrament_visiting_authorities
 *     (a dynamic-row field group, not individually addressable rows --
 *     see its own write-up below, right before that block)
 *
 * Every write is scoped to exactly the fields that were submitted --
 * nothing does a blanket "delete every row for this meeting first",
 * so an element that isn't on this meeting's agenda (or a column this
 * grid doesn't own, like a speaker's duration/confirmed) is never
 * touched, let alone cleared, by a save from here.
 *
 * **Skips unchanged fields, 2026-11-22** -- the same bug class fixed
 * in `saveCallingPlanningGrid` (2026-11-21): this is the single most-
 * used grid in the app (every meeting type's own Planning page), and
 * it has no per-field dirty tracking at all -- every element currently
 * on the agenda is resubmitted on every "Save All Changes" click
 * regardless of whether it was actually touched. Each of the six
 * sections below now fetches its own current stored values in one
 * batched query first, compares against what was submitted, and only
 * writes what actually differs -- with the changed fields in a given
 * section written concurrently rather than one at a time. Nothing
 * about which column a save is scoped to changed, only whether an
 * unchanged one still gets rewritten.
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
  // rather than trusting the UI, matching every other feature-gated
  // action in this app. `roleTable` alone can't tell apart Bishopric
  // Meeting/Ward Council/Youth Council (all three share
  // "bishopric_assignments"), so the meeting's own real type is looked
  // up fresh rather than guessed from it (2026-10-04, replacing a
  // single blanket "bishopric" check).
  const meeting = await getMeetingById(meetingId);
  if (!meeting) return { error: "Could not load this meeting." };
  if (!hasFeature(profile, meetingFeature(meeting.meetingType, "planning"))) return { error: "Not authorized." };

  const supabase = await createClient();

  const roles = new Map<string, { personId: string; guestName: string }>();
  const notes = new Map<string, { person?: string; text?: string }>();
  const planning = new Map<string, string>();
  const music = new Map<string, MusicPatch>();
  const speakers = new Map<string, SpeakerPatch>();
  const visitingAuthorities = new Map<string, { personId: string; guestName: string }>();

  for (const [name, rawValue] of formData.entries()) {
    const parts = name.split(FIELD_SEPARATOR);
    const value = String(rawValue).trim();

    switch (parts[0]) {
      case "role":
        if (parts.length === 2) {
          const entry = roles.get(parts[1]) ?? { personId: "", guestName: "" };
          entry.personId = value;
          roles.set(parts[1], entry);
        } else if (parts.length === 3) {
          const [, key, field] = parts;
          const entry = roles.get(key) ?? { personId: "", guestName: "" };
          if (field === "person_id") entry.personId = value;
          if (field === "guest_name") entry.guestName = value;
          roles.set(key, entry);
        }
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

      case "visiting_authority": {
        if (parts.length !== 3) break;
        const [, indexStr, field] = parts;
        const entry = visitingAuthorities.get(indexStr) ?? { personId: "", guestName: "" };
        if (field === "person_id") entry.personId = value;
        if (field === "guest_name") entry.guestName = value;
        visitingAuthorities.set(indexStr, entry);
        break;
      }

      default:
        break;
    }
  }

  // --- person_role elements -------------------------------------------
  if (roles.size > 0) {
    const selectCols = roleTable === "sacrament_assignments" ? "role, assigned_to_id, guest_name" : "role, assigned_to_id";
    const { data: existingRoleRows, error: fetchError } = await supabase
      .from(roleTable)
      .select(selectCols)
      .eq("meeting_id", meetingId)
      .in("role", Array.from(roles.keys()));
    if (fetchError) return { error: fetchError.message };

    type ExistingRoleRow = { role: string; assigned_to_id: string | null; guest_name?: string | null };
    const existingByRole = new Map(((existingRoleRows ?? []) as unknown as ExistingRoleRow[]).map((r) => [r.role, r]));

    const changedRoles = Array.from(roles.entries()).filter(([role, entry]) => {
      const existing = existingByRole.get(role);
      const currentPersonId = existing?.assigned_to_id ?? null;
      const currentGuestName = roleTable === "sacrament_assignments" ? existing?.guest_name ?? null : null;
      return currentPersonId !== (entry.personId || null) || currentGuestName !== (entry.guestName || null);
    });

    const roleResults = await Promise.all(
      changedRoles.map(async ([role, entry]) => {
        const { error: deleteError } = await supabase
          .from(roleTable)
          .delete()
          .eq("meeting_id", meetingId)
          .eq("role", role);
        if (deleteError) return { error: deleteError.message };

        if (entry.personId || entry.guestName) {
          const insertPayload: Record<string, unknown> = {
            meeting_id: meetingId,
            role,
            assigned_to_id: entry.personId || null,
          };
          // guest_name only exists on sacrament_assignments (migration 064,
          // Chorister/Organist's guest option) -- never send it to
          // bishopric_assignments, which has no such column.
          if (roleTable === "sacrament_assignments") insertPayload.guest_name = entry.guestName || null;
          const { error } = await supabase.from(roleTable).insert(insertPayload);
          if (error) return { error: error.message };
        }
        return { error: null as string | null };
      })
    );
    const roleFailure = roleResults.find((r) => r.error);
    if (roleFailure?.error) return { error: roleFailure.error };
  }

  // --- free_text / person_and_text elements ----------------------------
  if (notes.size > 0) {
    const { data: existingNoteRows, error: fetchError } = await supabase
      .from("meeting_element_notes")
      .select("element_key, person_id, text_value")
      .eq("meeting_id", meetingId)
      .in("element_key", Array.from(notes.keys()));
    if (fetchError) return { error: fetchError.message };

    type ExistingNoteRow = { element_key: string; person_id: string | null; text_value: string | null };
    const existingByKey = new Map(((existingNoteRows ?? []) as ExistingNoteRow[]).map((r) => [r.element_key, r]));

    const changedNotes = Array.from(notes.entries()).filter(([key, entry]) => {
      const existing = existingByKey.get(key);
      const currentPersonId = existing?.person_id ?? null;
      const currentText = existing?.text_value ?? null;
      return currentPersonId !== (entry.person || null) || currentText !== (entry.text || null);
    });

    const noteResults = await Promise.all(
      changedNotes.map(async ([key, entry]) => {
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
          return { error: error?.message ?? null };
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
        return { error: error?.message ?? null };
      })
    );
    const noteFailure = noteResults.find((r) => r.error);
    if (noteFailure?.error) return { error: noteFailure.error };
  }

  // --- sacrament_planning columns ---------------------------------------
  if (planning.size > 0) {
    const columnsSubmitted = Array.from(planning.keys());
    const { data: existingPlanningRow } = await supabase
      .from("sacrament_planning")
      .select(columnsSubmitted.join(", "))
      .eq("meeting_id", meetingId)
      .maybeSingle();
    const existingRecord = (existingPlanningRow ?? {}) as Record<string, unknown>;

    const payload: Record<string, unknown> = {};
    let anyChanged = false;
    for (const [column, value] of planning) {
      const newValue = PLANNING_BOOLEAN_COLUMNS.has(column) ? value === "on" : value || null;
      const currentValue = existingRecord[column] ?? (PLANNING_BOOLEAN_COLUMNS.has(column) ? false : null);
      if (currentValue !== newValue) anyChanged = true;
      payload[column] = newValue;
    }

    // Only the submitted columns are in the payload, so special_format
    // and hidden_notes keep whatever they already had. Skipped entirely
    // when nothing actually changed, rather than touching updated_at
    // for no real edit.
    if (anyChanged) {
      payload.meeting_id = meetingId;
      payload.updated_at = new Date().toISOString();
      const { error } = await supabase.from("sacrament_planning").upsert(payload, { onConflict: "meeting_id" });
      if (error) return { error: error.message };
    }
  }

  // --- music -----------------------------------------------------------
  if (music.size > 0) {
    // Auto-fill missing titles from Music Reference (2026-09-10, the
    // user's own report: "hymn numbers... weren't submitted with
    // titles") -- batched into one lookup rather than one query per row.
    // hymn_number is a free-text identifier now (migration 051), not a
    // plain integer -- "C20" means Children's Songbook #20, anything
    // else matches across the 1985 Hymnal and Hymns for Home and Church
    // (2026-10-03, the user's own request for the "C" prefix convention;
    // see lib/data/hymnal-shared.ts).
    const rawNumbersNeedingTitles: string[] = [];
    for (const patch of music.values()) {
      const num = patch.number?.trim() || null;
      if (num && !patch.title) rawNumbersNeedingTitles.push(num);
    }
    const titleByNumber = await lookupHymnTitles(rawNumbersNeedingTitles);

    // Every existing music row for this meeting, fetched once instead of
    // one lookup query per patch -- grouped by type so the slot-null
    // "singleton hymn type" matching rule below still works.
    const { data: existingMusicRows, error: fetchError } = await supabase
      .from("sacrament_music")
      .select("id, type, slot, hymn_number, piece_name, group_name")
      .eq("meeting_id", meetingId);
    if (fetchError) return { error: fetchError.message };

    type ExistingMusicRow = {
      id: string;
      type: string;
      slot: string | null;
      hymn_number: string | null;
      piece_name: string | null;
      group_name: string | null;
    };
    const musicByType = new Map<string, ExistingMusicRow[]>();
    for (const row of (existingMusicRows ?? []) as ExistingMusicRow[]) {
      const list = musicByType.get(row.type) ?? [];
      list.push(row);
      musicByType.set(row.type, list);
    }

    type MusicAction =
      | { kind: "delete"; id: string }
      | { kind: "update"; id: string; payload: Record<string, unknown> }
      | { kind: "insert"; payload: Record<string, unknown> };
    const actions: MusicAction[] = [];

    for (const patch of music.values()) {
      const hymnNumber = patch.number?.trim() || null;
      const pieceName = patch.title || (hymnNumber ? titleByNumber.get(hymnNumber) ?? null : null);
      const performer = patch.performer || null;
      const isEmpty = hymnNumber == null && !pieceName && !performer;

      // A singleton hymn type (slot null) matches on type alone -- only one
      // of each ever exists per meeting, and older rows may carry a stray
      // slot value from before this grid assigned them positionally.
      const candidates = musicByType.get(patch.type) ?? [];
      const existing = patch.slot === null ? candidates[0] : candidates.find((r) => r.slot === patch.slot);

      if (isEmpty) {
        if (existing) actions.push({ kind: "delete", id: existing.id });
        continue;
      }

      if (existing) {
        if (existing.hymn_number === hymnNumber && existing.piece_name === pieceName && existing.group_name === performer) {
          continue; // already correct -- nothing to write
        }
        actions.push({ kind: "update", id: existing.id, payload: { hymn_number: hymnNumber, piece_name: pieceName, group_name: performer } });
      } else {
        actions.push({
          kind: "insert",
          payload: {
            meeting_id: meetingId,
            type: patch.type,
            slot: patch.slot,
            hymn_number: hymnNumber,
            piece_name: pieceName,
            group_name: performer,
            status: "published",
            submitted_by: user.id,
          },
        });
      }
    }

    const musicResults = await Promise.all(
      actions.map((action) => {
        if (action.kind === "delete") return supabase.from("sacrament_music").delete().eq("id", action.id);
        if (action.kind === "update") return supabase.from("sacrament_music").update(action.payload).eq("id", action.id);
        return supabase.from("sacrament_music").insert(action.payload);
      })
    );
    const musicFailure = musicResults.find((r) => r.error);
    if (musicFailure?.error) return { error: musicFailure.error.message };
  }

  // --- speakers ---------------------------------------------------------
  if (speakers.size > 0) {
    // Every existing row across whichever speaker table(s) this meeting's
    // own patches actually touch, fetched once per table instead of one
    // lookup query per slot.
    const tablesUsed = Array.from(new Set(Array.from(speakers.values()).map((p) => p.table)));
    const fetches = await Promise.all(
      tablesUsed.map((t) => supabase.from(t).select("id, slot, speaker_id, guest_speaker_name, topic").eq("meeting_id", meetingId))
    );
    const fetchFailure = fetches.find((f) => f.error);
    if (fetchFailure?.error) return { error: fetchFailure.error.message };

    type ExistingSpeakerRow = { id: string; slot: string; speaker_id: string | null; guest_speaker_name: string | null; topic: string | null };
    const existingBySlotKey = new Map<string, ExistingSpeakerRow>();
    tablesUsed.forEach((t, i) => {
      for (const row of (fetches[i].data ?? []) as ExistingSpeakerRow[]) {
        existingBySlotKey.set(`${t}${FIELD_SEPARATOR}${row.slot}`, row);
      }
    });

    type SpeakerAction =
      | { kind: "delete"; id: string; table: SpeakerTable }
      | { kind: "update"; id: string; table: SpeakerTable; payload: Record<string, unknown> }
      | { kind: "insert"; table: SpeakerTable; payload: Record<string, unknown> };
    const actions: SpeakerAction[] = [];

    for (const patch of speakers.values()) {
      const speakerId = patch.person || null;
      const guestName = patch.guest || null;
      const topic = patch.topic || null;
      const isEmpty = !speakerId && !guestName && !topic;

      const existing = existingBySlotKey.get(`${patch.table}${FIELD_SEPARATOR}${patch.slot}`);

      if (isEmpty) {
        if (existing) actions.push({ kind: "delete", id: existing.id, table: patch.table });
        continue;
      }

      if (existing) {
        if (existing.speaker_id === speakerId && existing.guest_speaker_name === guestName && existing.topic === topic) {
          continue; // already correct -- nothing to write
        }
        // Update rather than delete-and-reinsert so duration/confirmed --
        // columns this grid doesn't show -- survive a save from here.
        actions.push({
          kind: "update",
          id: existing.id,
          table: patch.table,
          payload: { speaker_id: speakerId, guest_speaker_name: guestName, topic },
        });
      } else {
        actions.push({
          kind: "insert",
          table: patch.table,
          payload: { meeting_id: meetingId, slot: patch.slot, speaker_id: speakerId, guest_speaker_name: guestName, topic },
        });
      }
    }

    const speakerResults = await Promise.all(
      actions.map((action) => {
        if (action.kind === "delete") return supabase.from(action.table).delete().eq("id", action.id);
        if (action.kind === "update") return supabase.from(action.table).update(action.payload).eq("id", action.id);
        return supabase.from(action.table).insert(action.payload);
      })
    );
    const speakerFailure = speakerResults.find((r) => r.error);
    if (speakerFailure?.error) return { error: speakerFailure.error.message };
  }

  // --- visiting authorities ----------------------------------------------
  // Rendered as one field group with a dynamic row count (2026-10-03,
  // "much like the other dropdowns on the page... a + button... to add
  // another row"), not individually addressable rows the way speakers
  // or music items are -- so a save here replaces the meeting's whole
  // sacrament_visiting_authorities list with whatever was submitted
  // (dropping genuinely blank rows) rather than diffing row by row.
  // Only touched when the element is actually on this meeting's agenda:
  // `visitingAuthorities.size > 0` means at least one row's fields were
  // submitted, even if every one of them turns out blank -- which is
  // exactly "remove everything," handled below by inserting nothing.
  if (visitingAuthorities.size > 0) {
    const entries = Array.from(visitingAuthorities.entries())
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, entry]) => entry)
      .filter((entry) => entry.personId || entry.guestName);

    // Skip the whole replace-everything round trip when the submitted
    // list is byte-for-byte what's already stored, in the same order
    // (2026-11-22) -- this section submits every time the form is
    // saved, even when nobody touched Visiting Authorities at all.
    const { data: existingVaRows, error: fetchError } = await supabase
      .from("sacrament_visiting_authorities")
      .select("person_id, guest_name")
      .eq("meeting_id", meetingId)
      .order("sort_order", { ascending: true });
    if (fetchError) return { error: fetchError.message };

    type ExistingVaRow = { person_id: string | null; guest_name: string | null };
    const existingList = (existingVaRows ?? []) as ExistingVaRow[];
    const unchanged =
      existingList.length === entries.length &&
      existingList.every(
        (row, i) => (row.person_id ?? null) === (entries[i].personId || null) && (row.guest_name ?? null) === (entries[i].guestName || null)
      );

    if (!unchanged) {
      const { error: deleteError } = await supabase
        .from("sacrament_visiting_authorities")
        .delete()
        .eq("meeting_id", meetingId);
      if (deleteError) return { error: deleteError.message };

      if (entries.length > 0) {
        const { error: insertError } = await supabase.from("sacrament_visiting_authorities").insert(
          entries.map((entry, i) => ({
            meeting_id: meetingId,
            person_id: entry.personId || null,
            guest_name: entry.guestName || null,
            sort_order: i * 10,
          }))
        );
        if (insertError) return { error: insertError.message };
      }
    }
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}
