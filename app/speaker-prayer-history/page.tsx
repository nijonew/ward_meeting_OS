import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import {
  getSpeakerPrayerHistory,
  buildDueList,
  getSpeakingPrayingNotes,
  getActivePeopleWithAgeGroup,
  type DueEntry,
  type HistoryEntry,
  type SpeakingPrayingNote,
} from "@/lib/data/speaker-prayer-history";
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

function DueListCard({
  title,
  due,
  notesByPerson,
  noteKey,
}: {
  title: string;
  due: DueEntry[];
  notesByPerson: Map<string, SpeakingPrayingNote>;
  noteKey: "speaking_note" | "praying_note";
}) {
  return (
    <div className="rounded border border-rule bg-surface p-6">
      <h2 className="font-display text-xl">{title}</h2>
      <ul className="mt-3 flex flex-col gap-1.5">
        {due.length === 0 && <li className="text-sm text-ink-muted">Nobody in this group yet.</li>}
        {due.slice(0, 15).map((d) => (
          <li key={d.person_id} className="flex items-center justify-between text-sm">
            <span className="text-ink">
              {d.person_name}
              {notesByPerson.get(d.person_id)?.[noteKey] && (
                <span className="ml-1.5 text-[10px] text-ink-muted/70">({notesByPerson.get(d.person_id)?.[noteKey]})</span>
              )}
            </span>
            <span className="text-xs text-ink-muted">{d.last_date ? formatDate(d.last_date) : "Never"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
    getActivePeopleWithAgeGroup(),
    getSpeakingPrayingNotes(),
  ]);

  const speakerEntries = entries.filter((e) => e.role === "Speaker" || e.role === "Youth Speaker");
  const prayerEntries = entries.filter(
    (e) => e.role === "Opening Prayer" || e.role === "Closing Prayer" || e.role === "Prayer"
  );

  // Three "due" lists, not two (2026-10-27, the user's own vision):
  // speakers split by age_group (Adults, Youth), prayers left as one
  // list -- this ward's prayer assignment has no age distinction of
  // its own to split by, and the user's own wording ("a similar list
  // for prayers," singular) confirmed it shouldn't be split either.
  const adultPeople = people.filter((p) => p.age_group === "adult");
  const youthPeople = people.filter((p) => p.age_group === "youth");
  const dueToSpeakAdults = buildDueList(speakerEntries, adultPeople);
  const dueToSpeakYouth = buildDueList(speakerEntries, youthPeople);
  const dueToPray = buildDueList(prayerEntries, people);

  // Full History split into two, by category, rather than one combined
  // chronological list (2026-10-27, the user's own vision: "I want
  // separate lists for prayer and speakers").
  const speakerHistory = speakerEntries;
  const prayerHistory = prayerEntries;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Speaker & Prayer History" />

      <Link href="/meeting-planning" className="text-xs text-ink-muted hover:text-ink">
        &larr; Meeting Planning
      </Link>

      <section className="mt-4">
        <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">Speaker &amp; Prayer History</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Sourced from archived sacrament meetings, plus the ward&rsquo;s own imported history and anything
          logged by hand below. Speakers and sacrament-meeting prayers don&rsquo;t rotate automatically, so
          this is here to help spot who&rsquo;s due for a turn.
        </p>
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
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DueListCard title="Due to Speak (Adults)" due={dueToSpeakAdults} notesByPerson={notesByPerson} noteKey="speaking_note" />
            <DueListCard title="Due to Speak (Youth)" due={dueToSpeakYouth} notesByPerson={notesByPerson} noteKey="speaking_note" />
            <DueListCard title="Due for a Prayer" due={dueToPray} notesByPerson={notesByPerson} noteKey="praying_note" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <HistoryListCard title="Speaker History" entries={speakerHistory} notesByPerson={notesByPerson} noteKey="speaking_note" />
            <HistoryListCard title="Prayer History" entries={prayerHistory} notesByPerson={notesByPerson} noteKey="praying_note" />
          </div>
        </>
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