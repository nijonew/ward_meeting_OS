import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getAccessibleClasses, getTeachingAssignmentGrid } from "@/lib/data/teaching-assignments";
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
 * **Renamed "YM/YW Teaching Planning," same day** -- still this exact
 * page, same route, same `youth_teaching_planning` feature/
 * `youth_class_teachers` access control, just new display text. The
 * user's own request split this page's two audiences apart for real:
 * a plain, read-only "YM/YW Lessons" page (`/ym-yw-lessons`, open to
 * any signed-in account) now covers "viewing," shown under "My
 * meetings" -- this page stays the real, edit-capable "planning" half,
 * under "My calling" only, unchanged in every other respect.
 */
export default async function YouthTeachingPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ through?: string; class?: string }>;
}) {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!hasFeature(profile, "youth_teaching_planning")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="YM/YW Teaching Planning" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to YM/YW teaching planning.</p>
      </main>
    );
  }

  const accessibleClasses = await getAccessibleClasses(user.id);
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
  const grid = await getTeachingAssignmentGrid(throughDate, rawClass);

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
          <TeachingGridForm teachingClass={grid.teachingClass} rows={grid.rows} />
        )}
      </div>
    </main>
  );
}
