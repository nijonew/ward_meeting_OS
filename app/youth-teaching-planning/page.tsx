import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getAccessibleClasses, getTeachingAssignmentGrid, TEACHING_CLASSES } from "@/lib/data/teaching-assignments";
import { sweepMeetingCancellations } from "@/lib/data/meeting-cancellations";
import { getActivePeople } from "@/lib/data/people";
import { TeachingGridForm } from "@/components/youth-teaching-planning/TeachingGridForm";

/** 6 months out, computed fresh on every render -- "available for the
 *  next 6 months on a consistent rolling basis" (2026-11-05, the user's
 *  own request). Never stored, so this naturally slides forward every
 *  day with no extra code; the "Through" control below still lets
 *  anyone widen or narrow it for a single visit. */
function defaultThroughDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Renamed from "Teaching Calendar" (2026-09-09, the user's own
 * request) and reworked from one shared grid (every class as its own
 * column, all-or-nothing by role) into a hub: a tile per class the
 * viewer has access to, each landing on that one class's own
 * single-column grid via ?class=<name> -- mirrors the same
 * one-tile-per-type pattern already used by the landing page's "My
 * meetings" and /meeting-agendas. Old /teaching-calendar now just
 * redirects here (see that route's own page.tsx).
 *
 * The hub view gained an explicit "&larr; Home" back link (2026-09-09)
 * per the user's own request; the single-class view already had its
 * own "&larr; ..." link back to this hub.
 *
 * **Back link restored to "&larr; Home," 2026-11-08** -- had pointed
 * at `/youth-activity-planning` since 2026-10-10, when this page was
 * only reachable through that hub's own "Youth Teaching Management"
 * tile. That tile is gone now (`lib/data/nav-sections.ts`'s own
 * comment has the full story) -- this hub is reached directly from
 * Home again, via "My calling," so the back link points there again
 * too.
 *
 * **Renamed "YM/YW Teaching Planning," 2026-11-08** -- still this exact
 * page, same route, just new display text.
 *
 * **Access rebuilt calling-based, 2026-11-14** -- the old blanket
 * `youth_teaching_planning` feature gate is gone (see
 * `getAccessibleClasses`'s own doc comment, lib/data/teaching-assignments.ts,
 * for the full redesign). There's no separate "doesn't have access"
 * message any more -- any signed-in account reaches this hub, and
 * `accessibleClasses` being empty IS the "no access" state, shown
 * below with the real reason instead of a generic one.
 *
 * **Bug found and fixed 2026-11-14, same day: a calling holding
 * `teaching_schedule_all`/`_elders_quorum`/`_relief_society` showed
 * Elders Quorum and/or Relief Society as tiles on this page too.**
 * `getAccessibleClasses` deliberately unions every class a calling's
 * features resolve to -- youth AND adult -- since `/adult-teaching-planning`
 * needs that same union to decide which of its own two tables to show.
 * This hub never narrowed that list back down to just the 6 real youth
 * classes before rendering tiles (or before checking a `?class=`
 * param), so an account with broad teaching access saw the adult
 * organizations mixed in here, and could even reach one directly by
 * URL. Filtered to `TEACHING_CLASSES` right after resolving access --
 * the editable Elders Quorum/Relief Society tables stay exactly where
 * they already correctly are, `/adult-teaching-planning` (not the
 * read-only `/adult-teaching-lessons`, which has no feature gate at
 * all and was never meant to hold anything editable).
 */
export default async function YouthTeachingPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ through?: string; class?: string }>;
}) {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  const accessibleClasses = (await getAccessibleClasses(user.id, profile?.features)).filter((c) =>
    TEACHING_CLASSES.includes(c),
  );
  const { through: rawThrough, class: rawClass } = await searchParams;

  // Hub view: no class picked yet -- show one tile per class this
  // account can reach.
  if (!rawClass) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="YM/YW Teaching Planning" />

        <Link href="/" className="mt-6 text-xs text-ink-muted hover:text-ink">
          &larr; Home
        </Link>

        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">YM/YW Teaching Planning</h1>

        {accessibleClasses.length === 0 ? (
          <p className="mt-6 text-sm text-ink-muted">
            You haven&rsquo;t been assigned to teach a class yet. Ask the Bishopric if you think this
            is wrong.
          </p>
        ) : (
          <div className="mt-6">
            <TileGrid>
              {accessibleClasses.map((c) => (
                <Tile key={c} title={c} href={`/youth-teaching-planning?class=${encodeURIComponent(c)}`} />
              ))}
            </TileGrid>
          </div>
        )}
      </main>
    );
  }

  // Single-class view: verify this account is actually allowed to see
  // the requested class before rendering anything from it, not just
  // hiding its tile on the hub above -- someone could otherwise reach
  // it by typing the URL directly.
  if (!accessibleClasses.includes(rawClass)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="YM/YW Teaching Planning" />
        <p className="mt-10 text-ink-muted">You don&rsquo;t have access to that class.</p>
        <Link href="/youth-teaching-planning" className="mt-4 text-sm text-ink-muted hover:text-ink">
          &larr; YM/YW Teaching Planning
        </Link>
      </main>
    );
  }

  const throughDate = rawThrough || defaultThroughDate();
  // Lazy sweep, same pattern as every other cancellation list in this
  // app (autoArchivePastMeetings, sweepYouthActivityCancellations) --
  // called here rather than inside getTeachingAssignmentGrid itself to
  // avoid a circular import between this file's own data layer and
  // meeting-cancellations.ts (which needs ALL_TEACHING_CLASS_OPTIONS
  // from here). Cheap no-op when there's nothing scheduled to cancel.
  // The sweep must finish before the grid is read -- it may insert or
  // update the very rows getTeachingAssignmentGrid is about to select,
  // so it can't run concurrently with that read (unlike activePeople,
  // which is independent of both).
  await sweepMeetingCancellations();
  const [grid, activePeople] = await Promise.all([getTeachingAssignmentGrid(throughDate, rawClass), getActivePeople()]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="YM/YW Teaching Planning" />

      <section className="mt-4">
        <Link href="/youth-teaching-planning" className="text-xs text-ink-muted hover:text-ink">
          &larr; YM/YW Teaching Planning
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">{rawClass}</h1>
      </section>

      <div className="rounded border border-rule bg-surface p-6">
        <form method="get" className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="class" value={rawClass} />
          <label className="text-xs text-ink-muted">
            Through
            <input
              type="date"
              name="through"
              defaultValue={throughDate}
              className="ml-2 rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
            />
          </label>
          <button type="submit" className="rounded border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5">
            Update range
          </button>
        </form>

        {grid.rows.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No Sundays in this range.</p>
        ) : (
          <TeachingGridForm
            teachingClass={grid.teachingClass}
            rows={grid.rows}
            teacherSuggestions={activePeople.map((p) => p.name)}
          />
        )}
      </div>
    </main>
  );
}
