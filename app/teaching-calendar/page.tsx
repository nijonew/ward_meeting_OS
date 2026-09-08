import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getTeachingAssignmentGrid } from "@/lib/data/teaching-assignments";
import { TeachingGridForm } from "@/components/teaching-calendar/TeachingGridForm";

// Youth leaders + Bishopric only -- per the user (2026-09-08): "youth
// leaders and admins to have access." Unlike Youth Activities, there's
// no public view at all here, and no separate "who can edit" split --
// anyone who can see the calendar can also fill it in.
const ACCESS_ROLES = ["bishopric", "yw_presidency", "yw_advisor", "yw_specialist", "ym_advisor", "ym_specialist"];

function defaultThroughDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  return d.toISOString().slice(0, 10);
}

export default async function TeachingCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ through?: string }>;
}) {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!profile?.role || !ACCESS_ROLES.includes(profile.role)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Teaching Calendar" />
        <p className="mt-10 text-slate">Only youth leaders and the Bishopric can view the teaching calendar.</p>
      </main>
    );
  }

  const { through: rawThrough } = await searchParams;
  const throughDate = rawThrough || defaultThroughDate();

  const grid = await getTeachingAssignmentGrid(throughDate);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Teaching Calendar" />

      <section className="mt-4">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">Teaching Calendar</h1>
        <p className="mt-2 text-sm text-slate">
          Sunday teaching assignments for each class. Short free-text entries only &mdash; not linked
          to any person or calling record, so type whatever&rsquo;s useful (a name, a lesson topic,
          or both).
        </p>
      </section>

      <div className="rounded-lg border border-rule bg-card p-6">
        <form method="get" className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate">
            Through
            <input
              type="date"
              name="through"
              defaultValue={throughDate}
              className="ml-2 rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
            />
          </label>
          <button type="submit" className="rounded-md border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5">
            Update range
          </button>
        </form>

        {grid.rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate">No Sundays in this range.</p>
        ) : (
          <TeachingGridForm classes={grid.classes} rows={grid.rows} />
        )}
      </div>
    </main>
  );
}
