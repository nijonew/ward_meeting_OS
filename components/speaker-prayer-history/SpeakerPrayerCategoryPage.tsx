import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import {
  getSpeakerPrayerHistory,
  getSpeakingPrayingNotes,
  getDueFlags,
  type HistoryEntry,
  type DueCategory,
} from "@/lib/data/speaker-prayer-history";
import { getActivePeople } from "@/lib/data/people";
import { AddEntryForm } from "@/components/speaker-prayer-history/AddEntryForm";
import { HistoryListCard } from "@/components/speaker-prayer-history/HistoryListCard";

/**
 * The shared body for each of the three Speaker & Prayer History
 * sub-pages (`/speaker-prayer-history/adults|youth|prayers`), built
 * 2026-11-08 (the user's own request: "Put the speaker and prayer
 * tables on separate tables with their own tiles that show up in
 * their own page when speaker and prayer history tile is selected in
 * meeting planning"). Previously all three of these were one
 * `grid-cols-3` row on a single page -- now each has its own tile on
 * the hub (`/speaker-prayer-history`) and its own full-width page.
 *
 * Reuses `getSpeakerPrayerHistory()` completely unchanged -- the
 * function that already merges every archived Sacrament Meeting's
 * real speaker/prayer assignments with the manually-logged/historical-
 * import rows (built 2026-10-21, re-verified while doing this rebuild:
 * the merge, the per-table `confirmed = true` filters, and the ongoing
 * dedup against the import table all still check out correctly against
 * the current schema). The `filter` prop is the only thing that
 * differs per page -- which of that same combined list each one shows.
 */
export async function SpeakerPrayerCategoryPage({
  title,
  category,
  noteKey,
  filter,
}: {
  title: string;
  category: DueCategory;
  noteKey: "speaking_note" | "praying_note";
  filter: (entry: HistoryEntry) => boolean;
}) {
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

  const [allEntries, people, notesByPerson, dueFlags] = await Promise.all([
    getSpeakerPrayerHistory(),
    getActivePeople(),
    getSpeakingPrayingNotes(),
    getDueFlags(),
  ]);

  const entries = allEntries.filter(filter);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Speaker & Prayer History" />

      <section className="mt-4">
        <Link href="/speaker-prayer-history" className="text-xs text-ink-muted hover:text-ink">
          &larr; Speaker &amp; Prayer History
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
      </section>

      {entries.length === 0 && (
        <div className="rounded border border-rule bg-surface p-6">
          <p className="text-sm text-ink-muted">
            No history on record yet -- it fills in as meetings move to the archived stage, or log one by hand
            below.
          </p>
        </div>
      )}

      {entries.length > 0 && (
        <HistoryListCard category={category} entries={entries} notesByPerson={notesByPerson} noteKey={noteKey} dueFlags={dueFlags} />
      )}

      <div className="rounded border border-rule bg-surface p-6">
        <h2 className="font-display text-xl">Log a Missed or Pre-App Turn</h2>
        <p className="mt-1 text-xs text-ink-muted">
          For a turn this history doesn&rsquo;t already have on record -- doesn&rsquo;t need a real meeting.
        </p>
        <AddEntryForm people={people} />
      </div>
    </main>
  );
}
