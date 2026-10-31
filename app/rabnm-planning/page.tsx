import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getRabnmPlanningPool } from "@/lib/data/sacrament-rabnm-planning";
import { getActivePeople } from "@/lib/data/people";
import { RABNM_PLANNING_TYPES } from "@/lib/data/sacrament-constants";
import { RabnmPlanningCategorySection } from "@/components/rabnm-planning/RabnmPlanningCategorySection";

/**
 * The standing RABNM planning pool (migration 082) -- restores
 * planning-ahead access to Recognitions, Advancements, Baptisms, New
 * Members, and Baby Blessings, which had no planning-view UI at all
 * since the 2026-10-03 Ward Business rework collapsed everything down
 * to Callings/Releases pulled from Calling Planning. Mirrors Calling
 * Planning's own standing-pool-plus-pull-into-a-meeting mechanism; a
 * row added here shows up in Ward Business's own "Add to Ward
 * Business" dropdown (WardBusinessField.tsx) and drops out of this
 * page's own list once pulled into a specific meeting.
 *
 * Deliberately a simple add-a-row/remove-a-row list per category, no
 * bulk save, no sort/filter -- matching Teaching Program's own
 * simplicity rather than the "favorite grid format" (the user's own
 * explicit choice). The full sortable/filterable grid-with-Save-All-
 * Changes treatment of this same pool lives at Table Admin's
 * sacrament_rabnm_planning entry instead.
 */
export default async function RabnmPlanningPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  const canManage = hasFeature(profile, "sacrament_rabnm");
  if (!canManage) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Recognitions & Advancements Planning" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to Ward Business planning.</p>
      </main>
    );
  }

  const [pool, people] = await Promise.all([getRabnmPlanningPool(), getActivePeople()]);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Recognitions & Advancements Planning" />

      <Link href="/meeting-planning" className="text-xs text-ink-muted hover:text-ink">
        &larr; Meeting Planning
      </Link>

      <section>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">
          Recognitions &amp; Advancements Planning
        </h1>
      </section>

      <div className="flex flex-col gap-5">
        {RABNM_PLANNING_TYPES.map((category) => (
          <RabnmPlanningCategorySection
            key={category.value}
            type={category.value}
            label={category.label}
            items={pool[category.value]}
            people={people}
          />
        ))}
      </div>

      <footer className="mt-auto pt-16 text-xs text-ink-muted">Ward Meeting OS</footer>
    </main>
  );
}
