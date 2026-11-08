import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getTeachingAssignmentGrid, TEACHING_CLASS_OPTIONS } from "@/lib/data/teaching-assignments";
import { TeachingGridReadOnly } from "@/components/youth-teaching-planning/TeachingGridReadOnly";

/** 6 months out, computed fresh on every render -- same rolling
 *  horizon as YM/YW Teaching Planning (see that page's own comment). */
function defaultThroughDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

/**
 * YM/YW Lessons -- new 2026-11-08 (the user's own request): "Lessons
 * is for viewing for logged in youth and adults and it should show
 * date, topic, teacher but no edit ability, and it shows up in the
 * 'my meetings' areas." A plain, read-only counterpart to YM/YW
 * Teaching Planning (`/youth-teaching-planning`), open to any
 * signed-in account -- no feature check, no `youth_class_teachers`
 * check at all, unlike Planning's own per-class access control. Shown
 * under "My meetings" (`lib/data/nav-sections.ts`) unconditionally,
 * rather than "My calling" -- viewing a class's own schedule isn't
 * tied to a calling the way editing it is; Planning stays exactly as
 * gated as it already was, under "My calling" only.
 *
 * One combined page, all 6 classes at once -- confirmed directly
 * (`AskUserQuestion`) rather than guessed: the alternative, a hub with
 * a tile per class matching Planning's own structure, was declined
 * since there's no access restriction to gate per-class here anyway --
 * every tile would show for every viewer regardless of which class
 * they pick. Reuses the exact same `getTeachingAssignmentGrid` data
 * layer Planning already uses -- this page never writes anything, so
 * no new server action was needed; `TeachingGridReadOnly` is the only
 * new piece.
 */
export default async function YmYwLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ through?: string }>;
}) {
  const { user } = await getSessionUser();
  if (!user) redirect("/login");

  const { through: rawThrough } = await searchParams;
  const throughDate = rawThrough || defaultThroughDate();

  const grids = await Promise.all(TEACHING_CLASS_OPTIONS.map((c) => getTeachingAssignmentGrid(throughDate, c.value)));

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="YM/YW Lessons" />

      <Link href="/" className="text-xs text-ink-muted hover:text-ink">
        &larr; Home
      </Link>

      <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">YM/YW Lessons</h1>

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
        {grids.map((grid) => (
          <div key={grid.teachingClass} className="rounded border border-rule bg-surface p-6">
            <h2 className="font-display text-xl">{grid.teachingClass}</h2>
            {grid.rows.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">No Sundays in this range.</p>
            ) : (
              <TeachingGridReadOnly rows={grid.rows} />
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
