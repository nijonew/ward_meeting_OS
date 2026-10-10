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
 * already used elsewhere in this app. Mirrors `/meeting-planning`'s own
 * per-tile feature gating (2026-10-04 granular-features pass) rather
 * than one blanket flag for the whole page.
 *
 * **This is scaffolding, not the finished pages** -- per the user's
 * own plan ("We will then discuss each tile/page and what I want to
 * see there"), four tiles (Upcoming Activities and the three Combined
 * group views) are deliberately `comingSoon` for now rather than
 * guessed-at designs; the user wants every one of these in
 * table/matrix format (this app's established "favorite grid format,"
 * same as Assignment Rotations/Teaching Calendar/Calling Planning),
 * which is a real design pass still to come, not something to improvise
 * ahead of that discussion. Two tiles reuse real, already-working pages
 * instead of stubs where that reuse is unambiguous:
 *   - **Youth Activities Management** -> `/youth-activities`, gated on
 *     `youth_activity_planning`. That page already *is* the management
 *     surface today (Generate Combined Activities, Confirm/Cancel, add/
 *     edit) -- it also currently renders its own "Upcoming Activities"
 *     list inline, which is exactly the content the new standalone
 *     Upcoming Activities tile will eventually take over in matrix
 *     form; splitting that apart is part of the "discuss each page"
 *     work still to come, not done here.
 *   - **Youth Teaching Calendar** -> `/youth-teaching-planning`, gated
 *     on `youth_teaching_planning` -- same feature this tile already
 *     required when it sat directly on the landing page, unchanged.
 * **Youth Teaching Management** has no equivalent existing page to
 * reuse (Table Admin's raw `youth_class_teachers` grid is gated on its
 * own separate `table_admin_youth_class_teachers` feature, not this
 * one, so linking to it here would be a confusing mismatch -- see this
 * file's own git history/PROJECT_CONTEXT.md for the reasoning) --
 * `comingSoon` for now, gated on `youth_teaching_planning` so it's at
 * least invisible to accounts that could never use it.
 */
export default async function YouthActivityPlanningPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  const canManageActivities = hasFeature(profile, "youth_activity_planning");
  const canTeachingPlanning = hasFeature(profile, "youth_teaching_planning");

  if (!canManageActivities && !canTeachingPlanning) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Youth Activity Planning" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to the youth program.</p>
      </main>
    );
  }

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
            title="Upcoming Activities"
            description="Every planned activity, at a glance"
            comingSoon
          />
          <Tile
            title="Combined Young Men & Young Women Activities"
            description="Combined YM/YW activity schedule"
            comingSoon
          />
          <Tile
            title="Combined Young Men Activities"
            description="Combined YM activity schedule"
            comingSoon
          />
          <Tile
            title="Combined Young Women Activities"
            description="Combined YW activity schedule"
            comingSoon
          />
          {canManageActivities && (
            <Tile
              title="Youth Activities Management"
              description="Generate, confirm, and cancel activities"
              href="/youth-activities"
            />
          )}
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
