import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getAccessibleClasses, getTeachingAssignmentGrid } from "@/lib/data/teaching-assignments";
import { TeachingGridForm } from "@/components/youth-teaching-planning/TeachingGridForm";

function defaultThroughDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
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
 * own "&larr; Youth Teaching Planning" link back to this hub.
 *
 * **Back link updated to the new /youth-activity-planning hub,
 * 2026-10-10** -- this page is now reached one level deeper than
 * before (Home -> Youth Activity Planning -> Youth Teaching Calendar
 * -> this hub), since the landing page's direct tile into this page
 * was folded into that new hub -- see its own comment.
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
        <AppHeader tag="Youth Teaching Planning" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to youth teaching planning.</p>
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
        <AppHeader tag="Youth Teaching Planning" />

        <Link href="/youth-activity-planning" className="mt-6 text-xs text-ink-muted hover:text-ink">
          &larr; Youth Activity Planning
        </Link>

        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Youth Teaching Planning</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Sunday teaching assignments for each class. Short free-text entries only, not linked
          to any person or calling record.
        </p>

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
        <AppHeader tag="Youth Teaching Planning" />
        <p className="mt-10 text-ink-muted">You don&rsquo;t have access to that class.</p>
        <Link href="/youth-teaching-planning" className="mt-4 text-sm text-ink-muted hover:text-ink">
          &larr; Youth Teaching Planning
        </Link>
      </main>
    );
  }

  const throughDate = rawThrough || defaultThroughDate();
  const grid = await getTeachingAssignmentGrid(throughDate, [rawClass]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Youth Teaching Planning" />

      <section className="mt-4">
        <Link href="/youth-teaching-planning" className="text-xs text-ink-muted hover:text-ink">
          &larr; Youth Teaching Planning
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">{rawClass}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Sunday teaching assignments. Short free-text entries only, not linked to any person
          or calling record, so type whatever&rsquo;s useful (a name, a lesson topic, or both).
        </p>
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
          <TeachingGridForm classes={grid.classes} rows={grid.rows} />
        )}
      </div>
    </main>
  );
}
