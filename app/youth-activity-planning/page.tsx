import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

/**
 * Hub page for the landing page's "Youth program" section (2026-10-10,
 * the user's own request: "I want to start putting the youth activity
 * planning page(s) together... a landing page that will have an
 * Upcoming Activities tile, a Combined Young Men & Young Women
 * Activities tile, a Combined Young Men Activities tile, a Combined
 * Young Women Activities tile, Youth Activities Management tile
 * (visible only to those with feature access), a Youth Teaching
 * Calendar tile, and a Youth Teaching Management tile (visible only to
 * those with feature access)."
 *
 * Replaces the landing page's old two-tile "Youth program" section
 * (a direct "Youth Teaching Planning" tile plus a `comingSoon`
 * placeholder for "Youth Activity Planning") with one consolidated
 * entry point -- same `meeting-planning`/`meeting-agendas` hub pattern
 * already used elsewhere in this app.
 *
 * **Collapsed from 7 tiles down to 3, minutes after first shipping**,
 * per the user's own follow-up report: "the youth activities page
 * right now shows no tiles and just has all of the content on the
 * page. Please update with the suggested tiles which will then direct
 * the user to the requested page." The first version put all four
 * activity-specific tiles (Upcoming Activities and the three Combined
 * group views) directly here as `comingSoon` stubs, alongside a
 * separate "Youth Activities Management" tile pointing at
 * /youth-activities -- once those four were actually built, putting
 * them here too would have meant two different navigation paths to
 * the same destinations (duplicated here AND on /youth-activities'
 * own new tile grid). Resolved by moving all four activity tiles onto
 * /youth-activities itself (see that page's own comment) and
 * collapsing this hub's own activity-side presence down to one plain
 * "Youth Activities" tile pointing there -- ungated, matching that
 * page's own existing "any logged-in account can view" policy, since
 * management is no longer the only thing it's for.
 *   - **Youth Teaching Calendar** -> `/youth-teaching-planning`, gated
 *     on `youth_teaching_planning` -- same feature this tile already
 *     required when it sat directly on the landing page, unchanged.
 * **Youth Teaching Management** has no equivalent existing page to
 * reuse (Table Admin's raw `youth_class_teachers` grid is gated on its
 * own separate `table_admin_youth_class_teachers` feature, not this
 * one, so linking to it here would be a confusing mismatch) --
 * `comingSoon` for now, gated on `youth_teaching_planning` so it's at
 * least invisible to accounts that could never use it.
 */
export default async function YouthActivityPlanningPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  // No blanket "doesn't have access" gate here anymore -- Youth
  // Activities is open to any logged-in account now (matching
  // /youth-activities' own policy), so there's always at least one
  // real tile to show. Only the two teaching tiles stay feature-gated.
  const canTeachingPlanning = hasFeature(profile, "youth_teaching_planning");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Youth Activity Planning" />

      <Link href="/" className="mt-6 text-xs text-ink-muted hover:text-ink">
        &larr; Home
      </Link>

      <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Youth Activity Planning</h1>
      <p className="mt-2 text-sm text-ink-muted">Activities, the teaching calendar, and management tools.</p>

      <div className="mt-6">
        <TileGrid>
          <Tile
            title="Youth Activities"
            description="Browse, generate, and manage activities"
            href="/youth-activities"
          />
          {canTeachingPlanning && (
            <Tile
              title="Youth Teaching Calendar"
              description="Sunday teaching assignments for your class"
              href="/youth-teaching-planning"
            />
          )}
          {canTeachingPlanning && (
            <Tile
              title="Youth Teaching Management"
              description="Assign teachers to classes"
              comingSoon
            />
          )}
        </TileGrid>
      </div>
    </main>
  );
}
