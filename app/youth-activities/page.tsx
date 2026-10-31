import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

export default async function YouthActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ readonly?: string }>;
}) {
  // Now requires login (2026-10-07, the user's own request -- the
  // landing page's own tile shows "Please log in to see youth
  // activities" when logged out, and must actually mean it). Used to
  // be open with no login at all, relying on RLS to limit anonymous
  // visitors to published rows -- that RLS policy is unaffected and
  // still correct for a logged-in-but-otherwise-unprivileged viewer,
  // this just adds the login requirement on top of it.
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");
  const { readonly: rawReadOnly } = await searchParams;
  // `?readonly=1` (2026-10-12, same convention as /dashboard) -- set by
  // the landing page's own "This week" tile so that entry point stays
  // read-only even for an account that otherwise manages activities.
  // Propagated to every tile below so drilling into a Combined-group
  // page from here stays read-only too.
  const isReadOnly = rawReadOnly === "1";
  const canManage = hasFeature(profile, "youth_activity_planning") && !isReadOnly;
  const suffix = isReadOnly ? "?readonly=1" : "";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Youth Activities" />

      <div>
        <Link href="/youth-activity-planning" className="text-xs text-ink-muted hover:text-ink">
          &larr; Youth Activity Planning
        </Link>
      </div>

      {/* 2026-10-11 (the user's own request): the "All Activities"
          editable list that used to live below this grid is gone
          outright -- not moved anywhere. Per-row edits (status,
          confirmed, cancel/uncancel, delete) fall back to Table
          Admin's existing "Youth Activities" grid, which already
          exposes those same columns, same "bespoke page for everyday
          browsing, Table Admin for raw/bulk edits" split used
          elsewhere in this app. Add Activity, the cadence-rule
          manager, and both Generate actions moved to the new Manage
          tile/page below instead of sitting inline here. */}
      <TileGrid>
        <Tile title="Upcoming Activities" href={`/youth-activities/upcoming${suffix}`} />
        <Tile
          title="Combined Young Men & Young Women Activities"
          href={`/youth-activities/combined-ym-yw${suffix}`}
        />
        <Tile
          title="Combined Young Men Activities"
          href={`/youth-activities/combined-ym${suffix}`}
        />
        <Tile
          title="Combined Young Women Activities"
          href={`/youth-activities/combined-yw${suffix}`}
        />
        {canManage && (
          <Tile title="Manage" href="/youth-activities/manage" />
        )}
      </TileGrid>
    </main>
  );
}
