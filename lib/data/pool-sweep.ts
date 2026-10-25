import { createClient } from "@/lib/supabase/server";

/**
 * Shared "lazily sweep eligible pool rows into a meeting, skipping
 * anything already linked or explicitly excluded" mechanics --
 * extracted 2026-10-25 from `autoAnnounceReadyCallingPlanningItems`
 * (lib/data/calling-planning.ts) and `autoPullSacramentAnnouncements`
 * (lib/data/sacrament-announcements.ts), which had independently
 * implemented the identical shape -- and the identical bug, found and
 * fixed twice in one session: a manual Remove didn't stick because the
 * sweep had no way to tell "never offered yet" apart from "offered,
 * then explicitly removed." Pure logic consolidation -- no schema
 * change, no behavior change; each caller keeps its own "which
 * meeting(s) do I even target" strategy (Announcements: every meeting
 * whose Planning page loads while in-window; Calling Planning: the
 * single nearest-upcoming one) and calls this once per target meeting.
 *
 * A pool row can independently qualify on more than one `side` at once
 * (Calling Planning: `new_calling` and `release` on the same row) --
 * `sides` lets a caller with just one side (Announcements) pass a
 * single-entry array just as easily as Calling Planning's two.
 */
export interface PoolSweepSide<TRow> {
  side: string;
  isEligible: (row: TRow) => boolean;
  /** Returns true if it actually inserted something -- a side can be
   *  eligible by status but still have nothing valid to insert (e.g.
   *  Calling Planning's "to_announce" with zero candidates selected),
   *  in which case it shouldn't count as "linked" for `onLinked`. */
  insert: (row: TRow, meetingId: string) => Promise<boolean>;
}

export interface PoolSweepConfig<TRow> {
  fetchCandidates: () => Promise<TRow[]>;
  idOf: (row: TRow) => string;
  sides: PoolSweepSide<TRow>[];
  /** Keys are `"<poolId>::<side>"` -- every (row, side) pair already
   *  linked to this meeting. */
  alreadyLinked: (meetingId: string, poolIds: string[]) => Promise<Set<string>>;
  /** Same key shape -- every (row, side) pair explicitly excluded from
   *  this meeting (a prior manual Remove). */
  excluded: (meetingId: string, poolIds: string[]) => Promise<Set<string>>;
  /** Called once per row that had at least one side actually inserted
   *  this pass -- e.g. to set the pool row's own `announced_meeting_id`. */
  onLinked?: (row: TRow, meetingId: string) => Promise<void>;
}

export async function sweepPoolIntoMeeting<TRow>(meetingId: string, config: PoolSweepConfig<TRow>): Promise<void> {
  const rows = await config.fetchCandidates();
  if (rows.length === 0) return;

  const poolIds = rows.map(config.idOf);
  const [linked, excluded] = await Promise.all([
    config.alreadyLinked(meetingId, poolIds),
    config.excluded(meetingId, poolIds),
  ]);

  for (const row of rows) {
    const id = config.idOf(row);
    let linkedAny = false;

    for (const s of config.sides) {
      const key = `${id}::${s.side}`;
      if (linked.has(key) || excluded.has(key)) continue;
      if (!s.isEligible(row)) continue;
      if (await s.insert(row, meetingId)) linkedAny = true;
    }

    if (linkedAny && config.onLinked) await config.onLinked(row, meetingId);
  }
}

/** The ~5-line "clear a standing exclusion on a deliberate manual
 *  re-add" block that `pullCallingPlanningIntoMeeting`,
 *  `pullAnnouncementIntoMeeting`, and `pushCallingToSacramentMeeting`
 *  each had their own copy of -- a manual pull/push always means "yes,
 *  announce this after all," overriding a prior Remove regardless of
 *  which side (if any) it applies to. `sides` omitted clears every
 *  side for that (table, pool item, meeting) triple. */
export async function clearPoolExclusion(
  table: string,
  poolIdColumn: string,
  poolId: string,
  meetingId: string,
  sides?: string[]
): Promise<void> {
  const supabase = await createClient();
  let query = supabase.from(table).delete().eq(poolIdColumn, poolId).eq("meeting_id", meetingId);
  if (sides && sides.length > 0) query = query.in("side", sides);
  await query;
}
