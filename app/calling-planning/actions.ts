"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { insertSacramentRabnmLink } from "@/lib/data/sacrament-rabnm-linking";
import { syncCallingRosterFromPlanning } from "@/lib/data/calling-planning";
import { clearPoolExclusion } from "@/lib/data/pool-sweep";

type ActionResult = { success: true } | { error: string };
type SaveGridActionResult = { error?: string; success?: boolean };

// None of these four actions had a server-side check at all before this
// (2026-10-04, found while converting the page's own gate to the
// granular-features model) -- only the page's own gate kept the grid
// and its controls out of a non-admin's view.
async function requireCallingPlanningFeature(): Promise<{ error: string } | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "calling_planning")) return { error: "Not authorized." };
  return null;
}

/**
 * Starts a new calling-change row -- the flat grid's equivalent of the
 * old per-calling "Start New Planning Process" button, except it can be
 * done for any calling right from this one page instead of requiring a
 * detour through that calling's own detail page first.
 */
export async function createCallingPlanningEntry(formData: FormData): Promise<ActionResult> {
  const denied = await requireCallingPlanningFeature();
  if (denied) return denied;

  const supabase = await createClient();

  const callingId = String(formData.get("calling_id") ?? "");
  if (!callingId) return { error: "Choose a calling." };

  const dateInitiated = String(formData.get("date_initiated") ?? "") || null;

  // Auto-populate the release side (2026-10-13, the user's own
  // request: "when we add a calling change for a new calling I would
  // like to automatically add the associated release") -- a new
  // calling change for an already-filled calling almost always means
  // releasing whoever holds it now, so look that up and pre-fill it
  // instead of making the admin look it up separately. This restores
  // what the Vision & Intended Workflows doc originally specified for
  // this feature ("the person to be released is included by default
  // too -- a dropdown called in from the calling's own current...
  // holder") and the 2026-09-08 grid rebuild deliberately simplified
  // away. Left null (renders as "Previously Vacant" in the grid) when
  // the calling has no current holder -- nothing to release.
  const { data: calling } = await supabase
    .from("callings")
    .select("current_holder_id")
    .eq("id", callingId)
    .maybeSingle();
  const currentHolderId = (calling as { current_holder_id: string | null } | null)?.current_holder_id ?? null;

  const { error } = await supabase.from("calling_planning").insert({
    calling_id: callingId,
    date_initiated: dateInitiated,
    release_person_id: currentHolderId,
    release_status: currentHolderId ? "to_be_released" : "previously_vacant",
  });

  if (error) return { error: error.message };
  revalidatePath("/calling-planning");
  return { success: true };
}

/** Grid field names are "<planningId>::<fieldKey>" so one <form> can
 *  carry every row's every field at once, same convention as the
 *  Assignment Rotations and Teaching Calendar grids. */
function parseFieldName(name: string): { planningId: string; field: string } | null {
  const idx = name.indexOf("::");
  if (idx === -1) return null;
  return { planningId: name.slice(0, idx), field: name.slice(idx + 2) };
}

// date_set_apart dropped 2026-11-17, matching its removal from the
// grid itself (CallingPlanningGridForm.tsx's own comment) -- the
// column stays real in the schema, just nothing can submit this field
// name from the grid any more.
const EDITABLE_FIELDS = [
  "calling_id",
  "date_initiated",
  "calling_status",
  "notes",
  "release_person_id",
  "release_status",
] as const;

type RowPatch = Record<string, string | null> & { candidate_person_ids?: string[] };

/** The columns `saveCallingPlanningGrid` compares a submitted row
 *  against, to tell whether it actually changed -- see that function's
 *  own 2026-11-21 performance-fix comment. */
interface StoredRow {
  id: string;
  calling_id: string | null;
  date_initiated: string | null;
  calling_status: string;
  notes: string | null;
  release_person_id: string | null;
  release_status: string;
  candidate_person_ids: string[] | null;
}

/** Order-insensitive array equality -- `candidate_person_ids` can come
 *  back from the DB in a different order than the multi-select's own
 *  hidden inputs submitted it in, which isn't a real change. */
function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

/**
 * Saves every row's every field in one submit -- the "our favorite grid
 * format" pattern (2026-09-08, the user's own words) already built for
 * Assignment Rotations and Teaching Calendar: one big <form>, one "Save
 * All Changes" button, one UPDATE per row here (not the
 * delete-then-insert-per-cell approach those two use, since a calling
 * planning row already has a real id to update rather than being a
 * sparse per-cell record).
 *
 * candidate_person_ids is handled separately from every other field: a
 * <select multiple> submits one form-data entry per selected option
 * under the same name, so it needs formData.getAll(name) instead of the
 * single-value get() every other field uses -- and, since a multi-select
 * with nothing selected submits no entry at all, the grid renders a
 * hidden fallback input of the same name so "deselect everyone" is
 * still detectable as an explicit empty array rather than "field not
 * submitted, leave whatever was there."
 *
 * **Performance fix, 2026-11-21** (the user's own report: "the save
 * function was painfully slow... we had a lot of changes we were
 * working through and saving frequently"). The real cause wasn't just
 * that each row's write was sequential -- it's that this grid has no
 * per-row dirty tracking at all (unlike AdminTableEditor's own
 * `drafts`), only a single whole-form dirty flag. Every row's inputs
 * are always real DOM elements inside this one `<form>`, so
 * `formData` has always contained EVERY row currently in the grid on
 * EVERY submit, whether that row was touched or not. A ward with
 * 100+ `calling_planning` rows (this one has over that from migration
 * 067's own bulk import alone, plus everything added since) meant
 * every single "Save All Changes" click issued one UPDATE -- and, for
 * a row completing a calling or release, up to two more roster-sync
 * queries on top -- for every one of those 100+ rows, sequentially,
 * even to save a single Notes edit on one row.
 *
 * Fixed by fetching every submitted row's own current stored values
 * in one batched query, keeping only the rows that actually differ
 * from what's already saved, and running just those rows' own
 * writes concurrently -- "100+ rows in the grid" becomes "1 extra
 * read, plus however many rows really changed, written in parallel"
 * instead of a sequential pass over the whole table. Running changed
 * rows concurrently is safe for the same reason the roster-sync
 * failures right below already couldn't block each other (2026-10-30
 * fix) -- each row updates its own id, and `syncCallingRosterFromPlanning`
 * only ever writes `callings.current_holder_id` for that row's own
 * `calling_id`; two rows in the same batch that happen to share a
 * calling_id (e.g. a presidency change split across two rows) were
 * already resolved by whichever happened to process last under the
 * old sequential order -- parallel execution just makes that same
 * pre-existing ambiguity timing-based instead of Map-order-based, not
 * a new correctness risk.
 */
export async function saveCallingPlanningGrid(_prevState: unknown, formData: FormData): Promise<SaveGridActionResult> {
  const denied = await requireCallingPlanningFeature();
  if (denied) return denied;

  const supabase = await createClient();

  const byRow = new Map<string, RowPatch>();
  const seenNames = new Set<string>();

  for (const [name] of formData.entries()) {
    if (seenNames.has(name)) continue;
    seenNames.add(name);

    const parsed = parseFieldName(name);
    if (!parsed) continue;

    if (parsed.field === "candidate_person_ids") {
      const patch = byRow.get(parsed.planningId) ?? {};
      patch.candidate_person_ids = formData.getAll(name).map(String).filter(Boolean);
      byRow.set(parsed.planningId, patch);
      continue;
    }

    if (!EDITABLE_FIELDS.includes(parsed.field as (typeof EDITABLE_FIELDS)[number])) continue;
    const patch = byRow.get(parsed.planningId) ?? {};
    patch[parsed.field] = String(formData.get(name)).trim() || null;
    byRow.set(parsed.planningId, patch);
  }

  // calling_status/release_status are required columns -- never null
  // them out even if a <select> somehow submitted blank. Filled in
  // before comparing against the DB below, so a genuinely unchanged
  // row never reads as "changed" just because of this fallback.
  for (const patch of byRow.values()) {
    if (!patch.calling_status) patch.calling_status = "discussing";
    if (!patch.release_status) patch.release_status = "previously_vacant";
  }

  const rowIds = Array.from(byRow.keys());
  const { data: storedRows, error: fetchError } =
    rowIds.length > 0
      ? await supabase
          .from("calling_planning")
          .select("id, calling_id, date_initiated, calling_status, notes, release_person_id, release_status, candidate_person_ids")
          .in("id", rowIds)
      : { data: [] as StoredRow[], error: null };
  if (fetchError) return { error: fetchError.message };

  const storedById = new Map((storedRows ?? []).map((r) => [r.id as string, r as StoredRow]));

  const changedRows = Array.from(byRow.entries()).filter(([planningId, patch]) => {
    if (!patch.calling_id) return false; // can't save a row with no calling
    const stored = storedById.get(planningId);
    if (!stored) return true; // not found locally -- let the real UPDATE surface the actual error
    return (
      stored.calling_id !== patch.calling_id ||
      (stored.date_initiated ?? null) !== (patch.date_initiated ?? null) ||
      stored.calling_status !== patch.calling_status ||
      (stored.notes ?? null) !== (patch.notes ?? null) ||
      (stored.release_person_id ?? null) !== (patch.release_person_id ?? null) ||
      stored.release_status !== patch.release_status ||
      !sameIdSet(stored.candidate_person_ids ?? [], patch.candidate_person_ids ?? [])
    );
  });

  if (changedRows.length === 0) {
    return { success: true };
  }

  // Calling names for warnings, scoped to only the rows actually being
  // written now (not every row in the grid).
  const callingIds = Array.from(new Set(changedRows.map(([, patch]) => patch.calling_id).filter((id): id is string => Boolean(id))));
  const { data: callingRows } = callingIds.length > 0
    ? await supabase.from("callings").select("id, name").in("id", callingIds)
    : { data: [] as { id: string; name: string }[] };
  const callingNameById = new Map((callingRows ?? []).map((c) => [c.id, c.name]));

  // Every changed row's own update + roster sync runs concurrently now
  // -- see this function's own 2026-11-21 doc comment above for why
  // that's safe. Roster-sync failures for individual rows are still
  // collected rather than aborting the batch (2026-10-30 bug fix, the
  // user's own report: "I got an error and none of the changes
  // worked") -- the admin's own real edits (Notes, Status, Candidates,
  // etc.) should never be lost just because a secondary roster write
  // couldn't go through for one specific calling.
  const rowResults = await Promise.all(
    changedRows.map(async ([planningId, patch]) => {
      const { error } = await supabase
        .from("calling_planning")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", planningId);
      if (error) return { updateError: error.message, syncError: null as string | null };

      const syncError = await syncCallingRosterFromPlanning({
        calling_id: patch.calling_id as string,
        calling_status: patch.calling_status as string,
        candidate_person_ids: patch.candidate_person_ids ?? [],
        release_person_id: patch.release_person_id ?? null,
        release_status: patch.release_status as string,
      });
      return {
        updateError: null as string | null,
        syncError: syncError ? `${callingNameById.get(patch.calling_id as string) ?? "a calling"} (${syncError.error})` : null,
      };
    })
  );

  revalidatePath("/calling-planning");
  revalidatePath("/admin/people");
  revalidatePath("/admin/callings");
  revalidatePath("/callings");

  const updateFailures = rowResults.filter((r) => r.updateError).map((r) => r.updateError as string);
  const syncWarnings = rowResults.filter((r) => r.syncError).map((r) => r.syncError as string);

  if (updateFailures.length > 0) {
    const savedCount = rowResults.length - updateFailures.length;
    return {
      error:
        savedCount > 0
          ? `Saved ${savedCount} of ${rowResults.length} changed row(s). ${updateFailures.length} failed: ${updateFailures.join("; ")}`
          : updateFailures.join("; "),
    };
  }

  if (syncWarnings.length > 0) {
    return {
      success: true,
      error: `Saved. Couldn't update the roster for: ${syncWarnings.join("; ")} -- fix by hand at /admin/person-callings or /callings.`,
    };
  }

  return { success: true };
}

export async function deleteCallingPlanningEntry(planningId: string): Promise<ActionResult> {
  const denied = await requireCallingPlanningFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("calling_planning").delete().eq("id", planningId);

  if (error) return { error: error.message };
  revalidatePath("/calling-planning");
  return { success: true };
}

/**
 * The integration point with Sacrament Meeting: creates the matching
 * RABNM row(s) -- Release and/or New Calling -- on the chosen meeting,
 * which is the same table Planning and Conducting views already read
 * from. Records announced_meeting_id so this can't be double-pushed.
 * Adapted from the old app/callings/[id]/actions.ts version -- same
 * logic, just revalidating the new flat page instead of a per-calling one.
 */
export async function pushCallingToSacramentMeeting(
  planningId: string,
  callingId: string,
  _prevState: unknown,
  formData: FormData
): Promise<SaveGridActionResult> {
  const denied = await requireCallingPlanningFeature();
  if (denied) return denied;

  const supabase = await createClient();

  const meetingId = String(formData.get("meeting_id") ?? "");
  if (!meetingId) return { error: "Choose a meeting." };

  const { data: planning, error: fetchError } = await supabase
    .from("calling_planning")
    .select("calling_status, candidate_person_ids, release_person_id, release_status")
    .eq("id", planningId)
    .single();

  if (fetchError || !planning) {
    return { error: fetchError?.message ?? "Could not load this planning record." };
  }

  const candidateIds = (planning.candidate_person_ids ?? []) as string[];
  if (planning.calling_status === "to_announce" && candidateIds.length > 1) {
    return { error: "Narrow Candidates down to exactly one person before announcing the new calling." };
  }

  const inserts: { type: string; person_id: string }[] = [];
  const statusUpdates: Record<string, string> = {};

  // calling_status no longer auto-advances to "To Record" here
  // (2026-10-13, the user's own request: "I don't want the status of
  // those that are 'To be Announced' to change to 'To Record'
  // automatically. I want it to be a manual change for that status
  // change.") -- same fix as pullCallingPlanningIntoMeeting's own
  // matching change the same day; see that function's doc comment for
  // the full reasoning, including why release's own advance (to
  // "Complete") is unchanged.
  if (planning.calling_status === "to_announce" && candidateIds.length === 1) {
    inserts.push({ type: "new_calling", person_id: candidateIds[0] });
  }
  if (planning.release_status === "to_announce" && planning.release_person_id) {
    inserts.push({ type: "release", person_id: planning.release_person_id });
    statusUpdates.release_status = "complete";
  }

  if (inserts.length === 0) {
    return { error: "Nothing is marked \"To be Announced\" yet." };
  }

  for (const item of inserts) {
    // calling_planning_id set on insert (2026-10-15 bug fix, found from
    // the user's own detailed report: a calling pushed from THIS page,
    // then removed from Ward Business's own list, never came back and
    // could never be re-pushed). Without this link,
    // pullCallingPlanningIntoMeeting's counterpart undo
    // (removeCallingPlanningFromMeeting) was unreachable -- Ward
    // Business's Remove button falls back to a bare deleteRabnmItem
    // for any row with no calling_planning_id, which only deletes the
    // sacrament_rabnm row and never clears this row's own
    // announced_meeting_id/status, leaving it permanently stuck
    // pointing at an announcement that no longer exists. See migration
    // 076 for the one-time repair of rows already stuck this way.
    //
    // Shared with pullCallingPlanningIntoMeeting/pullRabnmPlanningIntoMeeting
    // (2026-10-25 consolidation) -- see lib/data/sacrament-rabnm-linking.ts.
    const inserted = await insertSacramentRabnmLink({
      meetingId,
      type: item.type,
      callingId,
      personIds: [item.person_id],
      linkColumn: "calling_planning_id",
      linkId: planningId,
    });
    if ("error" in inserted) return inserted;
  }

  const { error: updateError } = await supabase
    .from("calling_planning")
    .update({ announced_meeting_id: meetingId, ...statusUpdates, updated_at: new Date().toISOString() })
    .eq("id", planningId);

  if (updateError) return { error: updateError.message };

  // Release can reach "Complete" through this push too (calling_status
  // itself never does, per the 2026-10-13 no-auto-advance fix above) --
  // same roster sync the grid's own save applies, so either write path
  // keeps the real roster in step. A failure here is downgraded to a
  // warning, not a hard error (2026-10-30 bug fix, same reasoning as
  // saveCallingPlanningGrid's own identical change) -- by this point
  // the actual push (the sacrament_rabnm insert + calling_planning
  // update) has already committed, so a roster-sync problem shouldn't
  // make the push itself look like it failed.
  const syncError = await syncCallingRosterFromPlanning({
    calling_id: callingId,
    calling_status: String(planning.calling_status ?? ""),
    candidate_person_ids: candidateIds,
    release_person_id: planning.release_person_id,
    release_status: statusUpdates.release_status ?? String(planning.release_status ?? ""),
  });
  let syncWarning: string | null = null;
  if (syncError) {
    const { data: callingRow } = await supabase.from("callings").select("name").eq("id", callingId).maybeSingle();
    syncWarning = `Pushed, but couldn't update the roster for ${callingRow?.name ?? "this calling"} (${syncError.error}) -- fix by hand at /admin/person-callings or /callings.`;
  }

  // Clears any standing exclusion for whichever side(s) were just
  // pushed (2026-10-25, migration 084) -- a manual push here is a
  // deliberate "yes, announce this at this meeting after all," same
  // reasoning as pullCallingPlanningIntoMeeting's own identical fix.
  await clearPoolExclusion(
    "calling_planning_meeting_exclusions",
    "calling_planning_id",
    planningId,
    meetingId,
    inserts.map((i) => i.type)
  );

  revalidatePath("/calling-planning");
  revalidatePath(`/meetings/${meetingId}/planning`);
  revalidatePath("/admin/people");
  revalidatePath("/admin/callings");
  revalidatePath("/callings");
  return syncWarning ? { success: true, error: syncWarning } : { success: true };
}
