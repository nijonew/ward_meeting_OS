import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getTeachingAssignmentGrid } from "@/lib/data/teaching-assignments";
import { TeachingGridReadOnly } from "@/components/youth-teaching-planning/TeachingGridReadOnly";

/** 6 months out, computed fresh on every render -- same rolling
 *  horizon as Elders Quorum / Relief Society Teaching Planning. */
function defaultThroughDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Elders Quorum / Relief Society Lessons -- the read-only counterpart
 * to Elders Quorum / Relief Society Teaching Planning
 * (`/adult-teaching-planning`), 2026-11-08, same reasoning as YM/YW
 * Lessons' own doc comment: open to any signed-in account, no feature
 * check at all, shown under "My meetings" rather than "My calling".
 * The user's own original phrasing for this half was "relief society &
 * priesthood teaching planning" -- confirmed directly
 * (`AskUserQuestion`) that this means keeping the existing "Elders
 * Quorum" name as-is, not introducing "Priesthood" as a new label or a
 * third class.
 */
export default async function AdultTeachingLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ through?: string }>;
}) {
  const { user } = await getSessionUser();
  if (!user) redirect("/login");

  const { through: rawThrough } = await searchParams;
  const throughDate = rawThrough || defaultThroughDate();

  const [eqGrid, rsGrid] = await Promise.all([
    getTeachingAssignmentGrid(throughDate, "Elders Quorum"),
    getTeachingAssignmentGrid(throughDate, "Relief Society"),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Elders Quorum / Relief Society Lessons" />

      <Link href="/" className="text-xs text-ink-muted hover:text-ink">
        &larr; Home
      </Link>

      <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">
        Elders Quorum / Relief Society Lessons
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
            <TeachingGridReadOnly rows={eqGrid.rows} />
          )}
        </div>

        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Relief Society</h2>
          {rsGrid.rows.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No Sundays in this range.</p>
          ) : (
            <TeachingGridReadOnly rows={rsGrid.rows} />
          )}
        </div>
      </div>
    </main>
  );
}
