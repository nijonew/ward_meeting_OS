import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { MEETING_TYPE_LABELS, type MeetingTypeSlug } from "@/lib/types";

const ALL_MEETING_TYPES: MeetingTypeSlug[] = [
  "sacrament-meeting",
  "bishopric-meeting",
  "ward-council",
  "youth-council",
];

/**
 * Hub page for the "Meeting Agendas" tile on /meeting-planning
 * (2026-09-09, the user's own request: "add tile for each meeting type
 * under meeting agendas and separate the lists to those tiles"). Before
 * this, "Meeting Agendas" linked straight to /dashboard's single list
 * covering every meeting type at once (with a "Show all types" link
 * toggling a `type` filter) -- one tile per type here instead, each
 * landing directly on that type's own filtered `/dashboard?type=<slug>`
 * list, matching the same one-tile-per-type pattern the landing page's
 * "My meetings" section already uses. /dashboard itself is unchanged --
 * still works with or without a `type` filter, "Show all types" still
 * there for anyone who lands on one type and wants the merged view.
 *
 * Gained an explicit "&larr; Meeting Planning" back link (2026-09-09)
 * per the user's own request for a way back out of each hub.
 */
export default async function MeetingAgendasPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Meeting Agendas" />
        <p className="mt-10 text-slate">Only the Bishopric can access meeting agendas.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Meeting Agendas" />

      <Link href="/meeting-planning" className="mt-6 text-xs text-slate hover:text-ink">
        &larr; Meeting Planning
      </Link>

      <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">Meeting Agendas</h1>
      <p className="mt-2 text-sm text-slate">Create, cancel, and manage meetings, by type.</p>

      <div className="mt-6">
        <TileGrid>
          {ALL_MEETING_TYPES.map((slug) => (
            <Tile key={slug} title={MEETING_TYPE_LABELS[slug]} href={`/dashboard?type=${slug}`} />
          ))}
        </TileGrid>
      </div>
    </main>
  );
}
