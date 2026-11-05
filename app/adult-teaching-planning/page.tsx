import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getTeachingAssignmentGrid } from "@/lib/data/teaching-assignments";
import { TeachingGridForm } from "@/components/youth-teaching-planning/TeachingGridForm";

/** 6 months out, computed fresh on every render -- same rolling
 *  horizon as Youth Teaching Planning (see that page's own comment). */
function defaultThroughDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Elders Quorum / Relief Society Teaching Planning (2026-11-05, the
 * user's own request, right alongside the Youth Teaching Planning
 * rework): "a similar page... They would be the same page and would be
 * side by side in separate tables." Unlike Youth Teaching Planning,
 * there's no open-ended roster of classes here -- just these two fixed
 * organizations -- so this is one page, gated by a single feature,
 * rendering both tables at once rather than a hub + per-class drill-down.
 *
 * Reuses the exact same `teaching_assignments` table and
 * `getTeachingAssignmentGrid`/`TeachingGridForm`/`saveTeachingGrid`
 * mechanism as Youth Teaching Planning -- "Elders Quorum" and "Relief
 * Society" are just two more `class_name` values on that one shared
 * table. Same 5th-Sunday "Bishopric Planned" / "5th Sunday" default too
 * (see FIFTH_SUNDAY_TEACHER/FIFTH_SUNDAY_TOPIC) -- a 5th-Sunday
 * combined lesson is the same real convention for these two
 * organizations as it is for the youth classes.
 */
export default async function AdultTeachingPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ through?: string }>;
}) {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!hasFeature(profile, "adult_teaching_planning")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Elders Quorum / Relief Society Teaching Planning" />
        <p className="mt-10 text-ink-muted">
          Your account doesn&rsquo;t have access to Elders Quorum / Relief Society teaching planning.
        </p>
      </main>
    );
  }

  const { through: rawThrough } = await searchParams;
  const throughDate = rawThrough || defaultThroughDate();

  const [eqGrid, rsGrid] = await Promise.all([
    getTeachingAssignmentGrid(throughDate, "Elders Quorum"),
    getTeachingAssignmentGrid(throughDate, "Relief Society"),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Elders Quorum / Relief Society Teaching Planning" />

      <Link href="/" className="text-xs text-ink-muted hover:text-ink">
        &larr; Home
      </Link>

      <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">
        Elders Quorum / Relief Society Teaching Planning
      </h1>

      <div className="rounded border border-rule bg-surface p-6">
        <form method="get" className="flex flex-wrap items-center gap-3">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Elders Quorum</h2>
          {eqGrid.rows.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No Sundays in this range.</p>
          ) : (
            <TeachingGridForm teachingClass={eqGrid.teachingClass} rows={eqGrid.rows} />
          )}
        </div>

        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Relief Society</h2>
          {rsGrid.rows.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No Sundays in this range.</p>
          ) : (
            <TeachingGridForm teachingClass={rsGrid.teachingClass} rows={rsGrid.rows} />
          )}
        </div>
      </div>
    </main>
  );
}
