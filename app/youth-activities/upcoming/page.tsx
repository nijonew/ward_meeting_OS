import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getYouthActivities } from "@/lib/data/youth-activities";
import { explodeActivitiesByClass } from "@/lib/data/class-activities-shared";
import { ActivitiesTable } from "@/components/youth-activities/ActivitiesTable";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Read-only "every upcoming activity, all groups" view (2026-10-10,
 * the user's own spec: "show the activities for all youth, but will be
 * filterable for specific classes/quorums... columns for date, time,
 * description, notes"). Pulls from the one real `youth_activities`
 * table -- its own `group_name` column already spans every individual
 * class/quorum and all three Combined pseudo-groups, so "pull first
 * from the Combined tables... then read each individual class/quorum
 * activities table" described in that spec is really just this one
 * table with no filter applied; "filterable" is the ActivitiesTable
 * component's existing per-column filter, typing into the Group
 * column's own box. Description = the existing `title` field (the
 * user's own choice when asked, rather than adding a new column).
 * Read-only -- all adding/editing/generating stays on /youth-activities
 * itself, reached via the back link below.
 *
 * **Re-attributed to the 6 real classes, 2026-10-11** (the user's own
 * follow-up: "I only want to see a listing for each of the 6 groups...
 * no need to list those types as group. Just note in the notes that
 * it is a combined YM or combined YW activity") -- the Group column no
 * longer shows "Combined YM"/"Combined YW"/"Combined YM/YW" literally;
 * `explodeActivitiesByClass` re-attributes each Combined row to every
 * class it actually applies to (up to 6 separate rows for one Combined
 * YM/YW date) and folds which Combined type it came from into the
 * Notes column instead. Scoped to this page only -- the three
 * Combined-group pages keep showing the real shared row as-is, which
 * is the entire point of those pages (and of the Overwrite button
 * built on them minutes earlier).
 */
export default async function UpcomingActivitiesPage() {
  const { user } = await getSessionUser();
  if (!user) redirect("/login");

  const all = await getYouthActivities();
  const today = todayISO();
  const upcoming = explodeActivitiesByClass(all.filter((a) => a.activity_date >= today));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Upcoming Activities" />

      <section className="mt-4">
        <Link href="/youth-activities" className="text-xs text-ink-muted hover:text-ink">
          &larr; Youth Activities
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Upcoming Activities</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Every upcoming activity, for every class and quorum. A Combined activity is listed once
          per class that attends it, with a note on which Combined type it is, rather than as its
          own group. Type into the Group column&rsquo;s filter box to narrow to a specific class or
          quorum.
        </p>
      </section>

      <div className="rounded border border-rule bg-surface p-6">
        <ActivitiesTable activities={upcoming} storageKey="activities-upcoming" />
      </div>
    </main>
  );
}
