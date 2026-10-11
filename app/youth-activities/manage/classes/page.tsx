import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { ACTIVITY_CLASSES, getClassActivityGrid } from "@/lib/data/class-activities";
import { ClassActivityGridForm } from "@/components/youth-activities/ClassActivityGridForm";

function defaultThroughDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  return d.toISOString().slice(0, 10);
}

/**
 * "I need somewhere to manage each individual class's activities. it
 * should draw from the combined activity pages as appropriate and then
 * have the ability to fill in the rest, while all lines should
 * ultimately be editable even if they are prefilled by a combined
 * activity table" (the user's own request, 2026-10-11). Same hub +
 * per-class grid pattern as /youth-teaching-planning -- a tile per
 * class here lands on that one class's own grid via ?class=<name>.
 *
 * Gated on `youth_activity_planning` throughout (not a per-person
 * youth_class_teachers assignment like Teaching Planning) -- this is
 * the Activities domain, which has consistently used that one feature
 * for every management surface (Add Activity, cadence rules, both
 * Generate actions, and now this), not the Teaching domain's
 * per-person model.
 */
export default async function ManageClassActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ through?: string; class?: string }>;
}) {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!hasFeature(profile, "youth_activity_planning")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Manage Class Activities" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to manage youth activities.</p>
      </main>
    );
  }

  const { through: rawThrough, class: rawClass } = await searchParams;

  if (!rawClass) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Manage Class Activities" />

        <Link href="/youth-activities/manage" className="mt-6 text-xs text-ink-muted hover:text-ink">
          &larr; Manage Youth Activities
        </Link>

        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Class Activities</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Pick a class to see its own weekly schedule -- drawn from whatever Combined activity it
          attends that week, or its own individual activity, with every line editable either way.
        </p>

        <div className="mt-6">
          <TileGrid>
            {ACTIVITY_CLASSES.map((c) => (
              <Tile key={c} title={c} href={`/youth-activities/manage/classes?class=${encodeURIComponent(c)}`} />
            ))}
          </TileGrid>
        </div>
      </main>
    );
  }

  if (!ACTIVITY_CLASSES.includes(rawClass)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Manage Class Activities" />
        <p className="mt-10 text-ink-muted">That&rsquo;s not a real class.</p>
        <Link href="/youth-activities/manage/classes" className="mt-4 text-sm text-ink-muted hover:text-ink">
          &larr; Class Activities
        </Link>
      </main>
    );
  }

  const throughDate = rawThrough || defaultThroughDate();
  const rows = await getClassActivityGrid(rawClass, throughDate);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Manage Class Activities" />

      <section className="mt-4">
        <Link href="/youth-activities/manage/classes" className="text-xs text-ink-muted hover:text-ink">
          &larr; Class Activities
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">{rawClass}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          A row marked with a Combined label is shared with every other class that attends it --
          editing it here updates that same activity for them too. A plain row with no label is
          this class&rsquo;s own.
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

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No Wednesdays in this range.</p>
        ) : (
          <ClassActivityGridForm rows={rows} />
        )}
      </div>
    </main>
  );
}
