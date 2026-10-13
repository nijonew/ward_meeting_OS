import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getYouthActivities } from "@/lib/data/youth-activities";
import { ActivitiesTable } from "@/components/youth-activities/ActivitiesTable";
import { AddCombinedActivityForm } from "@/components/youth-activities/AddCombinedActivityForm";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Mostly read-only, pre-filtered to `group_name = "Combined YW"` --
 *  see /youth-activities/upcoming's own comment for the shared design.
 *  Gained an Add Activity form, a per-row Overwrite button, inline
 *  editing, and an "In Charge" (planning_group) column (2026-10-11,
 *  the user's own requests), all `youth_activity_planning`-gated --
 *  see ActivitiesTable's own comment for the latter two.
 *  `?readonly=1` (2026-10-12) forces all of that off regardless of
 *  feature -- set when reached via the landing page's "This week"
 *  tile, same convention as /dashboard. */
export default async function CombinedYwActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ readonly?: string }>;
}) {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");
  const { readonly: rawReadOnly } = await searchParams;
  const canManage = hasFeature(profile, "youth_activity_planning") && rawReadOnly !== "1";

  const all = await getYouthActivities();
  const today = todayISO();
  const activities = all.filter((a) => a.activity_date >= today && a.group_name === "Combined YW");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Combined YW Activities" />

      <section className="mt-4">
        <Link href="/youth-activities" className="text-xs text-ink-muted hover:text-ink">
          &larr; Youth Activities
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Combined Young Women Activities</h1>
      </section>

      {canManage && <AddCombinedActivityForm groupName="Combined YW" />}

      <div className="rounded border border-rule bg-surface p-6">
        <ActivitiesTable
          activities={activities}
          showGroupColumn={false}
          showPlanningGroupColumn
          showOverwriteColumn={canManage}
          editable={canManage}
          storageKey="activities-combined-yw"
        />
      </div>
    </main>
  );
}
