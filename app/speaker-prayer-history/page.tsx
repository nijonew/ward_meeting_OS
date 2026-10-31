import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import {
  getSpeakerPrayerHistory,
  getSpeakingPrayingNotes,
  type HistoryEntry,
  type SpeakingPrayingNote,
} from "@/lib/data/speaker-prayer-history";
import { getActivePeople } from "@/lib/data/people";
import { AddEntryForm } from "@/components/speaker-prayer-history/AddEntryForm";
import { DeleteEntryButton } from "@/components/speaker-prayer-history/DeleteEntryButton";

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * A meeting-sourced "Youth Speaker" row already means youth (it comes
 * from the separate `sacrament_speakers_youth` table) -- role wins over
 * `age_group` there. An import-sourced row is always labeled plain
 * "Speaker" regardless of age (migration 079's source sheet had no
 * adult/youth distinction of its own), so those fall back to the
 * person's own `age_group`; an unknown age (a guest, or no age set)
 * defaults to the Adults list rather than being silently dropped.
 */
function speakerBucket(entry: HistoryEntry): "adult" | "youth" {
  if (entry.role === "Youth Speaker") return "youth";
  return entry.age_group === "youth" ? "youth" : "adult";
}

function HistoryListCard({
  title,
  entries,
  notesByPerson,
  noteKey,
}: {
  title: string;
  entries: HistoryEntry[];
  notesByPerson: Map<string, SpeakingPrayingNote>;
  noteKey: "speaking_note" | "praying_note";
}) {
  return (
    <div className="rounded border border-rule bg-surface p-6">
      <h2 className="font-display text-xl">{title}</h2>
      <ul className="mt-3 flex flex-col gap-1.5">
        {entries.length === 0 && <li className="text-sm text-ink-muted">Nothing on record yet.</li>}
        {entries.map((e, i) => (
          <li
            key={i}
            className="flex items-baseline justify-between gap-3 border-b border-rule/40 py-1.5 text-sm last:border-0"
          >
            <span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">{e.role}</span>{" "}
              <span className="text-ink">{e.person_name}</span>
              {e.topic && <span className="text-ink-muted"> &middot; {e.topic}</span>}
              {e.person_id && notesByPerson.get(e.person_id)?.[noteKey] && (
                <span className="ml-1.5 text-[10px] text-ink-muted/70">({notesByPerson.get(e.person_id)?.[noteKey]})</span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-ink-muted">{formatDate(e.date)}</span>
              {e.historyImportId && <DeleteEntryButton entryId={e.historyImportId} />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function SpeakerPrayerHistoryPage() {
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

  const [entries, people, notesByPerson] = await Promise.all([
    getSpeakerPrayerHistory(),
    getActivePeople(),
    getSpeakingPrayingNotes(),
  ]);

  const speakerEntries = entries.filter((e) => e.role === "Speaker" || e.role === "Youth Speaker");
  const prayerEntries = entries.filter(
    (e) => e.role === "Opening Prayer" || e.role === "Closing Prayer" || e.role === "Prayer"
  );

  // Three history lists, no due lists (2026-10-30, the user's own
  // correction of the earlier due-list design: "I would rather not
  // have due lists, just history lists for speakers (Adults), Speakers
  // (Youth), and prayers. No need for due lists.").
  const speakerAdultHistory = speakerEntries.filter((e) => speakerBucket(e) === "adult");
  const speakerYouthHistory = speakerEntries.filter((e) => speakerBucket(e) === "youth");
  const prayerHistory = prayerEntries;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Speaker & Prayer History" />

      <Link href="/meeting-planning" className="text-xs text-ink-muted hover:text-ink">
        &larr; Meeting Planning
      </Link>

      <section className="mt-4">
        <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">Speaker &amp; Prayer History</h1>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HistoryListCard title="Speakers (Adults)" entries={speakerAdultHistory} notesByPerson={notesByPerson} noteKey="speaking_note" />
          <HistoryListCard title="Speakers (Youth)" entries={speakerYouthHistory} notesByPerson={notesByPerson} noteKey="speaking_note" />
          <HistoryListCard title="Prayers" entries={prayerHistory} notesByPerson={notesByPerson} noteKey="praying_note" />
        </div>
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