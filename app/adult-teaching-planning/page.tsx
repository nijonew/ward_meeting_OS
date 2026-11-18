import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getAccessibleClasses, getTeachingAssignmentGrid } from "@/lib/data/teaching-assignments";
import { sweepMeetingCancellations } from "@/lib/data/meeting-cancellations";
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
 *
 * **Access rebuilt calling-based and split per organization,
 * 2026-11-14** -- the old blanket `adult_teaching_planning` feature
 * always showed both tables to anyone holding it; a calling can now
 * be granted Elders Quorum, Relief Society, or both independently (see
 * `getAccessibleClasses`'s own doc comment, lib/data/teaching-assignments.ts).
 * A calling that already held the old feature was carried over to both
 * new scopes by migration `104`, so nobody using this page lost access
 * when this shipped.
 */
export default async function AdultTeachingPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ through?: string }>;
}) {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  const accessibleClasses = await getAccessibleClasses(user.id, profile?.features);
  const canSeeEldersQuorum = accessibleClasses.includes("Elders Quorum");
  const canSeeReliefSociety = accessibleClasses.includes("Relief Society");

  if (!canSeeEldersQuorum && !canSeeReliefSociety) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Elders Quorum / Relief Society Teaching Planning" />
        <p className="mt-10 text-ink-muted">
          You haven&rsquo;t been assigned to teach Elders Quorum or Relief Society yet. Ask the Bishopric
          if you think this is wrong.
        </p>
      </main>
    );
  }

  const { through: rawThrough } = await searchParams;
  const throughDate = rawThrough || defaultThroughDate();

  // Lazy sweep (2026-11-14) -- see /youth-teaching-planning's own
  // comment on this exact same call for why it's done here rather than
  // inside getTeachingAssignmentGrid itself.
  await sweepMeetingCancellations();

  const [eqGrid, rsGrid] = await Promise.all([
    canSeeEldersQuorum ? getTeachingAssignmentGrid(throughDate, "Elders Quorum") : null,
    canSeeReliefSociety ? getTeachingAssignmentGrid(throughDate, "Relief Society") : null,
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

      {/* Single column when only one organization is actually granted
          (2026-11-14) -- side-by-side only made sense when every
          viewer always saw both. */}
      <div className={eqGrid && rsGrid ? "grid gap-6 lg:grid-cols-2" : "grid gap-6"}>
        {eqGrid && (
        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Elders Quorum</h2>
          {eqGrid.rows.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No Sundays in this range.</p>
          ) : (
            <TeachingGridForm teachingClass={eqGrid.teachingClass} rows={eqGrid.rows} />
          )}
        </div>
        )}

        {rsGrid && (
        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Relief Society</h2>
          {rsGrid.rows.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No Sundays in this range.</p>
          ) : (
            <TeachingGridForm teachingClass={rsGrid.teachingClass} rows={rsGrid.rows} />
          )}
        </div>
        )}
      </div>
    </main>
  );
}
