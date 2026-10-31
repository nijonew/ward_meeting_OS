import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

/**
 * Hub page for the landing page's "Youth program" section (2026-10-10,
 * the user's own request -- see the previous version of this file's
 * own doc comment in git history for the full build-up through a
 * 7-tile first draft, then a 3-tile collapse once the four activity
 * views landed on `/youth-activities` instead).
 *
 * **Flattened back down to the real destinations directly, 2026-10-17**
 * (the user's own report: "There are too many levels to the tile
 * pages. I would like to enter the youth activity planning page and
 * immediately see tiles for upcoming activities, combined YM/YW,
 * combined YW, Combined YM, youth teaching management, activity
 * cancellations... Any other tiles can be hidden."). The 3-tile
 * version above had regressed into exactly the "too many levels"
 * problem it was trying to fix for the opposite reason -- "Youth
 * Activities" here was itself just another hub (`/youth-activities`)
 * with its own tile grid for the four real activity views, so reaching
 * Upcoming Activities took Home -> here -> Youth Activities -> Upcoming
 * Activities, three hops deep. This hub now links straight to all four
 * activity views itself, skipping that middle layer, plus the two
 * remaining real destinations (Youth Teaching Planning, Activity
 * Cancellations) -- six tiles total, matching the user's own list
 * exactly, in the order they gave it.
 *
 * `/youth-activities` itself is NOT deleted or redirected -- `/events`
 * (the public merged activities/ward-events listing) links straight to
 * it ("Manage Youth Activities"), and its own Manage tile is still the
 * real home for the cadence-rule engine and bulk Generate, neither of
 * which the user named in their six-tile list. Per their own "any other
 * tiles can be hidden" -- not "delete" -- those stay reachable (from
 * `/events`, or the de-emphasized text link at the bottom of this page),
 * just no longer a tile on this hub.
 *
 * **Youth Teaching Management** is a relabeling of what this hub
 * previously called "Youth Teaching Calendar" -- same destination
 * (`/youth-teaching-planning`, unrenamed internally; see that page's
 * own doc comment), just matching the user's own new wording for this
 * tile specifically. The old, separate `comingSoon` "Youth Teaching
 * Management" stub (for assigning teachers to classes, a genuinely
 * different, never-built idea -- see that file's prior doc comment in
 * git history) is dropped along with every other now-hidden tile; ask
 * before building that one for real if it turns out to still be wanted
 * under a different name.
 */
export default async function YouthActivityPlanningPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  const canManageActivities = hasFeature(profile, "youth_activity_planning");
  const canTeachingPlanning = hasFeature(profile, "youth_teaching_planning");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Youth Activity Planning" />

      <Link href="/" className="mt-6 text-xs text-ink-muted hover:text-ink">
        &larr; Home
      </Link>

      <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Youth Activity Planning</h1>

      <div className="mt-6">
        <TileGrid>
          <Tile title="Upcoming Activities" href="/youth-activities/upcoming" />
          <Tile
            title="Combined Young Men & Young Women Activities"
            href="/youth-activities/combined-ym-yw"
          />
          <Tile
            title="Combined Young Women Activities"
            href="/youth-activities/combined-yw"
          />
          <Tile
            title="Combined Young Men Activities"
            href="/youth-activities/combined-ym"
          />
          {canTeachingPlanning && (
            <Tile
              title="Youth Teaching Management"
              href="/youth-teaching-planning"
            />
          )}
          {canManageActivities && (
            <Tile
              title="All-Youth Activity Cancellations"
              href="/youth-activity-cancellations"
            />
          )}
        </TileGrid>
      </div>

      {canManageActivities && (
        <Link href="/youth-activities" className="mt-8 text-xs text-ink-muted hover:text-ink">
          Need cadence rules or to bulk-generate activities? Youth Activities &rarr;
        </Link>
      )}
    </main>
  );
}
