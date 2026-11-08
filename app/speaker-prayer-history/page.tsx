import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

/**
 * Turned into a hub, 2026-11-08 (the user's own request: "Put the
 * speaker and prayer tables on separate tables with their own tiles
 * that show up in their own page when speaker and prayer history tile
 * is selected in meeting planning"). This page used to render all
 * three history lists itself, side by side in one `grid-cols-3` row --
 * now it just routes to each one's own full page
 * (`/speaker-prayer-history/adults|youth|prayers`), same one-tile-per-
 * destination pattern already used by `/youth-teaching-planning` and
 * `/meeting-agendas`. The "Speaker & Prayer History" tile in Meeting
 * Planning/My calling still links straight here, unchanged -- only
 * what's behind it changed.
 */
export default async function SpeakerPrayerHistoryHubPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!hasFeature(profile, "speaker_prayer_history")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Speaker & Prayer History" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to speaker and prayer history.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Speaker & Prayer History" />

      <Link href="/meeting-planning" className="mt-6 text-xs text-ink-muted hover:text-ink">
        &larr; Meeting Planning
      </Link>

      <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Speaker &amp; Prayer History</h1>

      <div className="mt-6">
        <TileGrid>
          <Tile title="Speakers (Adults)" href="/speaker-prayer-history/adults" />
          <Tile title="Speakers (Youth)" href="/speaker-prayer-history/youth" />
          <Tile title="Prayers" href="/speaker-prayer-history/prayers" />
        </TileGrid>
      </div>
    </main>
  );
}
