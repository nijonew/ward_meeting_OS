import { createClient } from "@/lib/supabase/server";
import { getActivePeople } from "@/lib/data/people";
import { getMountainTimeNow } from "@/lib/data/timezone";
import { insertSacramentRabnmLink } from "@/lib/data/sacrament-rabnm-linking";
import { sweepPoolIntoMeeting } from "@/lib/data/pool-sweep";

export interface CallingDetail {
  id: string;
  name: string;
  title_prefix: string | null;
  current_holder_id: string | null;
  current_holder_name: string | null;
  active: boolean;
}

/** Fallback options if admin_select_options has no rows yet for these
 *  fields -- see lib/data/select-options.ts. Also what migration
 *  066_calling_planning_status_vocabulary.sql replaces the table's own
 *  rows with, so switching over to the DB-backed list is a no-op until
 *  someone actually edits it.
 *
 *  **Redesigned 2026-10-10**, the user's own ordered list, replacing
 *  the original 022-seeded vocabulary entirely -- "Needed, In review,
 *  Approved, Interview Set, Accepted, Declined, To be Announced, To
 *  Record, Complete, For Stake, Future, Hold" /
 *  "Previously Vacant, To be released, interview set, release
 *  extended, to be announced, Complete". `discussing` keeps its old
 *  value key (now labeled "In Review") and `to_announce`/`to_record`/
 *  `complete`/`future`/`declined`/`previously_vacant` keep theirs too
 *  -- those five are the ones real application code branches on by
 *  value (see app/calling-planning/actions.ts and
 *  app/meetings/[id]/ward-business-actions.ts), so reusing the same
 *  keys means every existing row and every piece of app logic that
 *  reads/writes them keeps working without a data migration of its
 *  own. Genuinely new stages (Needed, Approved, Interview Set,
 *  Accepted, For Stake, Hold, To be Released, Release Extended) get
 *  brand new value keys. "To Be Set Apart" is dropped entirely -- it
 *  has no equivalent in the new vocabulary; see the same two action
 *  files' comments for how the auto-advance logic that used to target
 *  it was adjusted. */
export const DEFAULT_CALLING_STATUSES = [
  { value: "needed", label: "Needed" },
  { value: "discussing", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "interview_set", label: "Interview Set" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "to_announce", label: "To be Announced" },
  { value: "to_record", label: "To Record" },
  { value: "complete", label: "Complete" },
  { value: "for_stake", label: "For Stake" },
  { value: "future", label: "Future" },
  { value: "hold", label: "Hold" },
];

export const DEFAULT_RELEASE_STATUSES = [
  { value: "previously_vacant", label: "Previously Vacant" },
  { value: "to_be_released", label: "To be Released" },
  { value: "interview_set", label: "Interview Set" },
  { value: "release_extended", label: "Release Extended" },
  { value: "to_announce", label: "To be Announced" },
  { value: "complete", label: "Complete" },
];

export interface CallingPlanningRow {
  id: string;
  calling_id: string;
  calling_name: string;
  calling_title_prefix: string | null;
  date_initiated: string | null;
  /** Who's under consideration -- multi-select, real people (migration
   *  044 replaced the free-text Candidates field and the single-select
   *  Selected Person with this one multi-valued column). Once narrowed
   *  to exactly one, that's who the Sacrament Meeting push treats as
   *  decided -- see pushCallingToSacramentMeeting. */
  candidate_person_ids: string[];
  calling_status: string;
  date_set_apart: string | null;
  release_person_id: string | null;
  release_status: string;
  notes: string | null;
  announced_meeting_id: string | null;
  created_at: string;
}

export interface CallingOption {
  id: string;
  name: string;
  title_prefix: string | null;
}

export function personName(rel: unknown): string | null {
  if (Array.isArray(rel)) return (rel[0] as { name?: string } | undefined)?.name ?? null;
  return (rel as { name?: string } | null)?.name ?? null;
}

export async function getCallingDetail(callingId: string): Promise<CallingDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("callings")
    .select("id, name, title_prefix, current_holder_id, active, people:current_holder_id(name)")
    .eq("id", callingId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    title_prefix: data.title_prefix,
    current_holder_id: data.current_holder_id,
    current_holder_name: personName(data.people),
    active: data.active,
  };
}

/**
 * Every calling, filled or vacant, active or not -- for the grid's
 * "Calling" dropdown. Deliberately unfiltered (2026-09-08, the user's
 * own report: "the list of potential callings seems to pull only from
 * callings that are already filled... I need to include any and all
 * callings") -- planning a change is exactly the workflow that needs
 * to reach a calling with no current holder, so filtering on
 * `active`/`current_holder_id` here would work directly against the
 * feature's own purpose. Ordered the same way the roster itself is
 * (sort_order), not alphabetically, so it matches whatever order the
 * ward already thinks of callings in.
 */
export async function getCallingOptions(): Promise<CallingOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("callings")
    .select("id, name, title_prefix")
    .order("sort_order");

  return error || !data ? [] : data;
}

export interface CallableCallingItem {
  /** calling_planning.id -- what Ward Business's pull/un-pull actions
   *  key off (app/meetings/[id]/ward-business-actions.ts). */
  id: string;
  callingId: string;
  callingName: string;
  personId: string;
  personName: string;
  /** calling_status/release_status is already "To Announce in
   *  Sacrament" -- surfaced first, as a ready-made suggestion. */
  ready: boolean;
}

/**
 * Calling Planning rows not yet announced in any meeting, split into
 * "Callings" (a single narrowed-down candidate) and "Releases" (a
 * release person set) -- for Ward Business's inline Calling Planning
 * picker (2026-10-03, the user's own request: "prefilled with items
 * from calling planning that are listed as ready to announce... the
 * ability to call in other items from calling planning even if they
 * aren't marked as ready"). `ready` flags the ones already marked "To
 * Announce in Sacrament" (pushCallingToSacramentMeeting's own
 * threshold) -- everything else is still returned, just not
 * pre-suggested, so an admin can pull one in early if they choose to.
 *
 * A calling_status row with more than one candidate is left out of the
 * Callings list entirely -- same rule pushCallingToSacramentMeeting
 * already enforces: there's no single person yet to announce. A row
 * can appear in both lists at once (e.g. a presidency change with both
 * a new calling and a release pending).
 *
 * **Excludes "Complete," 2026-10-13** (the user's own request: "in the
 * dropdown for callings and releases I want to exclude those that are
 * marked 'complete'"). A row can reach `calling_status`/`release_status
 * === "complete"` without ever going through this exact pull/announce
 * flow (e.g. an admin sets it directly in the grid for a change that's
 * already fully done) -- `announced_meeting_id is null` alone doesn't
 * catch that case, so a long-finished item could otherwise still clutter
 * this picker with nothing meaningful left to announce. Checked per side
 * independently, same as `ready` -- a row complete on one side but still
 * pending on the other (e.g. the release is done but the new calling
 * isn't yet) still appears in whichever list still has something to do.
 */
export async function getCallableCallingPlanningItems(): Promise<{
  callings: CallableCallingItem[];
  releases: CallableCallingItem[];
}> {
  const supabase = await createClient();
  const [{ data: rows }, people] = await Promise.all([
    supabase
      .from("calling_planning")
      .select("id, calling_status, candidate_person_ids, release_person_id, release_status, callings(id, name)")
      .is("announced_meeting_id", null),
    getActivePeople(),
  ]);

  const nameById = new Map(people.map((p) => [p.id, p.name]));
  const callings: CallableCallingItem[] = [];
  const releases: CallableCallingItem[] = [];

  for (const row of (rows ?? []) as unknown[]) {
    const r = row as {
      id: string;
      calling_status: string;
      candidate_person_ids: string[] | null;
      release_person_id: string | null;
      release_status: string;
      callings: { id: string; name: string } | { id: string; name: string }[] | null;
    };
    const calling = Array.isArray(r.callings) ? r.callings[0] : r.callings;
    if (!calling) continue;

    const candidateIds = r.candidate_person_ids ?? [];
    if (candidateIds.length === 1 && r.calling_status !== "complete") {
      const personName = nameById.get(candidateIds[0]);
      if (personName) {
        callings.push({
          id: r.id,
          callingId: calling.id,
          callingName: calling.name,
          personId: candidateIds[0],
          personName,
          ready: r.calling_status === "to_announce",
        });
      }
    }

    if (r.release_person_id && r.release_status !== "complete") {
      const personName = nameById.get(r.release_person_id);
      if (personName) {
        releases.push({
          id: r.id,
          callingId: calling.id,
          callingName: calling.name,
          personId: r.release_person_id,
          personName,
          ready: r.release_status === "to_announce",
        });
      }
    }
  }

  return { callings, releases };
}

/**
 * Keeps the real roster (`callings.current_holder_id`) in step with
 * Calling Planning once a change is far enough along to be real -- the
 * user's own request (2026-10-30): "I would like to have calling
 * planning, people and callings all linked... so that a change to one
 * affects the others," confirmed via follow-up to trigger "when the
 * calling value in calling planning is to record or complete" (assign
 * the one narrowed-down candidate) and "unassign based on the release
 * completion" (clear it back to vacant).
 *
 * Idempotent and state-based, not edge-triggered -- re-applies every
 * time a row's current status qualifies, not just the first time it
 * crosses the threshold, so the roster can't quietly drift out of sync
 * with whatever Calling Planning itself currently says is true. Release
 * is applied before the assign so a presidency change -- a release and
 * a new calling for the SAME calling_id both completing in the same
 * save -- lands on "the new candidate," not "vacant." The release-side
 * clear only ever fires while the roster still shows the person being
 * released (`.eq("current_holder_id", releasePersonId)`), never
 * unconditionally, so a holder someone else already assigned in the
 * meantime can't be silently displaced by stale release data.
 *
 * A calling can have more than one real `callings` row sharing the same
 * name if more than one person genuinely holds that kind of calling at
 * once (this ward's existing "Stake High Councilor (<area>)" pattern)
 * -- this only ever touches the ONE `calling_id` named on this planning
 * row, same single-holder-per-row model as every other write to
 * `current_holder_id` in this app (including /admin/person-callings).
 * Called from both `saveCallingPlanningGrid` (the grid's own per-row
 * save) and `pushCallingToSacramentMeeting` (which can also advance
 * release_status to "complete") -- the one real write site for either
 * status is already each caller's own, so this only ever observes
 * whatever status the caller is about to persist, never decides it.
 */
export async function syncCallingRosterFromPlanning(row: {
  calling_id: string;
  calling_status: string;
  candidate_person_ids: string[];
  release_person_id: string | null;
  release_status: string;
}): Promise<{ error: string } | null> {
  const supabase = await createClient();

  if (row.release_status === "complete" && row.release_person_id) {
    const { error } = await supabase
      .from("callings")
      .update({ current_holder_id: null })
      .eq("id", row.calling_id)
      .eq("current_holder_id", row.release_person_id);
    if (error) return { error: error.message };
  }

  if ((row.calling_status === "to_record" || row.calling_status === "complete") && row.candidate_person_ids.length === 1) {
    const { error } = await supabase
      .from("callings")
      .update({ current_holder_id: row.candidate_person_ids[0] })
      .eq("id", row.calling_id);
    if (error) return { error: error.message };
  }

  return null;
}

/**
 * Auto-populates the single nearest upcoming (not cancelled, not
 * archived) Sacrament Meeting's Ward Business with every calling_planning
 * row still marked "To be Announced" on either side -- the user's own
 * request (2026-10-15): "I would like to have those calling and
 * release announcement automatically added to the next sacrament
 * meeting. They can be added to the current week's sacrament meeting
 * each week until their status is changed. We will then control in
 * the sacrament planning view if they will be announced or not."
 *
 * Deliberately independent of `announced_meeting_id` for its own
 * eligibility check -- that column means "most recently linked to
 * *a* meeting," which only ever points at one meeting at a time, but
 * `calling_status`/`release_status` can resolve on different weeks
 * from each other (e.g. a release gets recorded while the matching
 * new calling is still pending). Checks per side, directly, whether a
 * `sacrament_rabnm` row already links this `calling_planning` row to
 * THIS specific meeting -- if not, and that side's status is still
 * `to_announce`, creates it (the same effect as
 * `pullCallingPlanningIntoMeeting`, just run automatically instead of
 * by a click) and sets `announced_meeting_id` to this meeting
 * afterward so the manual "call in another" dropdown stays consistent
 * (still excludes it, same as any other already-pulled row).
 *
 * "We will control... if they will be announced or not" is the
 * existing Remove button on the meeting's own Planning page, read as
 * "not this week" rather than a permanent decline -- removing an item
 * clears `announced_meeting_id` without touching its status, which is
 * exactly what makes it eligible for this sweep to pick back up (onto
 * whichever meeting is current by the time it next runs). The one
 * real "stop" is a status change away from `to_announce`, which this
 * sweep never touches itself.
 *
 * Lazy sweep on read, same pattern as `autoArchivePastMeetings`/
 * `sweepMeetingCancellations` -- called unconditionally whenever any
 * Sacrament Meeting's Planning page loads, but only ever writes to the
 * one meeting that's actually nearest-upcoming as of right now, so
 * planning several weeks ahead at once never duplicates the same
 * pending item across more than one future meeting.
 *
 * **Respects a standing exclusion, 2026-10-25** (migration 084, the
 * user's own report: "I am not able to remove released individuals
 * from sacrament meeting planning"). Before this, removing a release
 * (or new calling) from the meeting that's currently the single
 * nearest-upcoming one -- the single most common case -- only ever
 * cleared `announced_meeting_id`, which made the row immediately
 * eligible again, so the very next page load re-ran this exact sweep
 * and re-created the identical row right back. `removeCallingPlanningFromMeeting`
 * (app/meetings/[id]/ward-business-actions.ts) now also records a
 * `calling_planning_meeting_exclusions` row on removal -- checked here
 * alongside the existing "already linked" check -- which
 * `pullCallingPlanningIntoMeeting`/`pushCallingToSacramentMeeting`
 * both clear again on a deliberate manual re-add.
 *
 * **Sweep mechanics extracted into `sweepPoolIntoMeeting`, 2026-10-25**
 * (`lib/data/pool-sweep.ts`) -- shared with `autoPullSacramentAnnouncements`
 * (`lib/data/sacrament-announcements.ts`), which had independently grown
 * the identical "skip anything already linked or excluded" shape. This
 * function keeps its own "find the single nearest-upcoming meeting"
 * logic and its two sides' real eligibility/insert rules; only the
 * generic loop moved. Each side's `insert` calls Module 1's
 * `insertSacramentRabnmLink` (`lib/data/sacrament-rabnm-linking.ts`),
 * the same helper `pullCallingPlanningIntoMeeting`/
 * `pushCallingToSacramentMeeting` already call for a manual pull. Pure
 * refactor -- no behavior change.
 */
interface CallingPlanningSweepRow {
  id: string;
  calling_id: string;
  calling_status: string;
  candidate_person_ids: string[] | null;
  release_person_id: string | null;
  release_status: string;
}

export async function autoAnnounceReadyCallingPlanningItems(): Promise<void> {
  const supabase = await createClient();
  const { dateIso: today } = getMountainTimeNow();

  const { data: meetingRows } = await supabase
    .from("meetings")
    .select("id, meeting_types!inner(slug)")
    .eq("meeting_types.slug", "sacrament-meeting")
    .eq("cancelled", false)
    .neq("stage", "archived")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1);

  const meetingId = (meetingRows?.[0] as { id: string } | undefined)?.id;
  if (!meetingId) return;

  await sweepPoolIntoMeeting<CallingPlanningSweepRow>(meetingId, {
    fetchCandidates: async () => {
      const { data: rows } = await supabase
        .from("calling_planning")
        .select("id, calling_id, calling_status, candidate_person_ids, release_person_id, release_status")
        .or("calling_status.eq.to_announce,release_status.eq.to_announce");
      return (rows ?? []) as CallingPlanningSweepRow[];
    },
    idOf: (row) => row.id,
    sides: [
      {
        side: "new_calling",
        isEligible: (row) => row.calling_status === "to_announce" && (row.candidate_person_ids ?? []).length === 1,
        insert: async (row, mtgId) => {
          const inserted = await insertSacramentRabnmLink({
            meetingId: mtgId,
            type: "new_calling",
            callingId: row.calling_id,
            personIds: [row.candidate_person_ids![0]],
            linkColumn: "calling_planning_id",
            linkId: row.id,
          });
          return !("error" in inserted);
        },
      },
      {
        side: "release",
        isEligible: (row) => Boolean(row.release_person_id) && row.release_status === "to_announce",
        insert: async (row, mtgId) => {
          const inserted = await insertSacramentRabnmLink({
            meetingId: mtgId,
            type: "release",
            callingId: row.calling_id,
            personIds: [row.release_person_id!],
            linkColumn: "calling_planning_id",
            linkId: row.id,
          });
          return !("error" in inserted);
        },
      },
    ],
    alreadyLinked: async (mtgId, poolIds) => {
      const { data: existingLinks } = await supabase
        .from("sacrament_rabnm")
        .select("calling_planning_id, type")
        .eq("meeting_id", mtgId)
        .in("calling_planning_id", poolIds);
      return new Set(
        ((existingLinks ?? []) as { calling_planning_id: string | null; type: string }[]).map(
          (l) => `${l.calling_planning_id}::${l.type}`
        )
      );
    },
    excluded: async (mtgId, poolIds) => {
      const { data: exclusions } = await supabase
        .from("calling_planning_meeting_exclusions")
        .select("calling_planning_id, side")
        .eq("meeting_id", mtgId)
        .in("calling_planning_id", poolIds);
      return new Set(
        ((exclusions ?? []) as { calling_planning_id: string; side: string }[]).map((e) => `${e.calling_planning_id}::${e.side}`)
      );
    },
    onLinked: async (row, mtgId) => {
      await supabase
        .from("calling_planning")
        .update({ announced_meeting_id: mtgId, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    },
  });
}

/**
 * Every calling-planning row, across every calling, one row per
 * potential calling change -- the flat grid the user's own spreadsheet
 * models this on. Pass callingId to scope to just one calling (used by
 * the calling detail page's "changes involving this calling" link).
 */
export async function getAllCallingPlanningRows(callingId?: string): Promise<CallingPlanningRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("calling_planning")
    .select(
      "id, calling_id, date_initiated, candidate_person_ids, calling_status, date_set_apart, release_person_id, release_status, notes, announced_meeting_id, created_at, callings(name, title_prefix)"
    )
    .order("created_at", { ascending: false });

  if (callingId) {
    query = query.eq("calling_id", callingId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as unknown[]).map((row) => {
    const r = row as {
      id: string;
      calling_id: string;
      date_initiated: string | null;
      candidate_person_ids: string[] | null;
      calling_status: string;
      date_set_apart: string | null;
      release_person_id: string | null;
      release_status: string;
      notes: string | null;
      announced_meeting_id: string | null;
      created_at: string;
      callings: { name?: string; title_prefix?: string | null } | { name?: string; title_prefix?: string | null }[] | null;
    };
    const calling = Array.isArray(r.callings) ? r.callings[0] : r.callings;

    return {
      id: r.id,
      calling_id: r.calling_id,
      calling_name: calling?.name ?? "(unknown calling)",
      calling_title_prefix: calling?.title_prefix ?? null,
      date_initiated: r.date_initiated,
      candidate_person_ids: r.candidate_person_ids ?? [],
      calling_status: r.calling_status,
      date_set_apart: r.date_set_apart,
      release_person_id: r.release_person_id,
      release_status: r.release_status,
      notes: r.notes,
      announced_meeting_id: r.announced_meeting_id,
      created_at: r.created_at,
    };
  });
}
