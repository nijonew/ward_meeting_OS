import { createClient } from "@/lib/supabase/server";

/**
 * Writes fresh sort_order values (0, 10, 20, ...) for a full reordered
 * list -- the shared write-side half of every drag-reorderable list in
 * this app (2026-10-31, the user's own request: "apply broadly
 * everywhere!" once asked about converting every Move Up/Down control
 * to a drag handle). Replaces the old one-step-at-a-time
 * swap-adjacent-sort_order Move Up/Down actions this app used to have
 * everywhere (moveRotationMember, moveWardBusinessItem,
 * moveTemplateElement, moveAnnouncementPull, moveProgramItem,
 * moveDefaultTemplateElement) -- a real drag can drop an item anywhere
 * in one motion, not just nudge it by one position, so the write needs
 * to accept the WHOLE new order at once rather than a single swap.
 *
 * `table`/`idColumn` are always literal strings hardcoded by the
 * caller, never derived from request input -- this exists only to
 * avoid repeating the same loop in every one of this app's many
 * reorderable lists, not to let a client pick which table gets
 * written. `scope` narrows the update to one list's own rows when a
 * table holds more than one independent order at once (e.g.
 * sacrament_rabnm's `type` column, or a rotation's own `rotation_id`)
 * -- every id must already belong to that scope; this never moves a
 * row between lists, only reorders within one. A scope value of `null`
 * matches `is <col> null` instead of `eq <col> null` (which never
 * matches anything in Postgres) -- needed for `meeting_templates`'
 * own nullable `format_key` scope (the shared, no-special-format
 * default template for a meeting type).
 *
 * Every row's update runs in parallel -- unlike the rotation-assignment
 * RPCs elsewhere in this app (apply_rotation_assignment), a plain
 * sort_order write has no shared pointer or ordering dependency
 * between rows, so there's nothing to lose by not awaiting them one at
 * a time.
 */
export async function writeSortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  idColumn: string,
  orderedIds: string[],
  scope?: Record<string, string | null>
): Promise<{ error?: string }> {
  if (orderedIds.length === 0) return {};

  const results = await Promise.all(
    orderedIds.map((id, index) => {
      let query = supabase.from(table).update({ sort_order: index * 10 }).eq(idColumn, id);
      if (scope) {
        for (const [key, value] of Object.entries(scope)) {
          query = value === null ? query.is(key, null) : query.eq(key, value);
        }
      }
      return query;
    })
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };
  return {};
}
