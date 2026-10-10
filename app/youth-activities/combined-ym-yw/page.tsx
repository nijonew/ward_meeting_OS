import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getYouthActivities } from "@/lib/data/youth-activities";
import { ActivitiesTable } from "@/components/youth-activities/ActivitiesTable";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Read-only, pre-filtered to `group_name = "Combined YM/YW"` -- see
 *  /youth-activities/upcoming's own comment for the shared design
 *  (same ActivitiesTable component, same one real `youth_activities`
 *  table, no Group column since every row here already shares one). */
export default async function CombinedYmYwActivitiesPage() {
  const { user } = await getSessionUser();
  if (!user) redirect("/login");

  const all = await getYouthActivities();
  const today = todayISO();
  const activities = all.filter((a) => a.activity_date >= today && a.group_name === "Combined YM/YW");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Combined YM/YW Activities" />

      <section className="mt-4">
        <Link href="/youth-activities" className="text-xs text-ink-muted hover:text-ink">
          &larr; Youth Activities
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">
          Combined Young Men & Young Women Activities
        </h1>
      </section>

      <div className="rounded border border-rule bg-surface p-6">
        <ActivitiesTable activities={activities} showGroupColumn={false} />
      </div>
    </main>
  );
}
