import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getSpeakerPrayerHistory, buildDueList } from "@/lib/data/speaker-prayer-history";
import { getActivePeople } from "@/lib/data/people";

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function SpeakerPrayerHistoryPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Speaker & Prayer History" />
        <p className="mt-10 text-slate">Only the Bishopric can view speaker and prayer history.</p>
      </main>
    );
  }

  const [entries, people] = await Promise.all([getSpeakerPrayerHistory(), getActivePeople()]);

  const speakerEntries = entries.filter((e) => e.role === "Speaker" || e.role === "Youth Speaker");
  const prayerEntries = entries.filter((e) => e.role === "Opening Prayer" || e.role === "Closing Prayer");

  const dueToSpeak = buildDueList(speakerEntries, people);
  const dueToPray = buildDueList(prayerEntries, people);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Speaker & Prayer History" />

      <section className="mt-4">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">Speaker &amp; Prayer History</h1>
        <p className="mt-2 text-sm text-slate">
          Sourced from archived sacrament meetings only. Speakers and sacrament-meeting prayers don&rsquo;t
          rotate automatically, so this is here to help spot who&rsquo;s due for a turn.
        </p>
      </section>

      {entries.length === 0 && (
        <div className="rounded-lg border border-rule bg-card p-6">
          <p className="text-sm text-slate">
            No archived sacrament meetings yet. History fills in as meetings move to the archived stage.
          </p>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-rule bg-card p-6">
              <h2 className="font-display text-xl">Due to Speak</h2>
              <ul className="mt-3 flex flex-col gap-1.5">
                {dueToSpeak.slice(0, 15).map((d) => (
                  <li key={d.person_id} className="flex items-center justify-between text-sm">
                    <span className="text-ink">{d.person_name}</span>
                    <span className="text-xs text-slate">{d.last_date ? formatDate(d.last_date) : "Never"}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-rule bg-card p-6">
              <h2 className="font-display text-xl">Due for a Prayer</h2>
              <ul className="mt-3 flex flex-col gap-1.5">
                {dueToPray.slice(0, 15).map((d) => (
                  <li key={d.person_id} className="flex items-center justify-between text-sm">
                    <span className="text-ink">{d.person_name}</span>
                    <span className="text-xs text-slate">{d.last_date ? formatDate(d.last_date) : "Never"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-rule bg-card p-6">
            <h2 className="font-display text-xl">Full History</h2>
            <ul className="mt-3 flex flex-col gap-1.5">
              {entries.map((e, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 border-b border-rule/40 py-1.5 text-sm last:border-0">
                  <span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-slate/70">{e.role}</span>{" "}
                    <span className="text-ink">{e.person_name}</span>
                    {e.topic && <span className="text-slate"> &mdash; {e.topic}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-slate">{formatDate(e.date)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </main>
  );
}