import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getUpcomingMusicCoordination } from "@/lib/data/music-coordination";

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={[
        "rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-widest",
        ok ? "bg-sage/15 text-sage" : "bg-brass/15 text-brass",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

export default async function MusicCoordinationPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Music Coordination" />
        <p className="mt-10 text-slate">Only the Bishopric can view music coordination.</p>
      </main>
    );
  }

  const rows = await getUpcomingMusicCoordination();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Music Coordination" />

      <section className="mt-4">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">Music Coordination</h1>
        <p className="mt-2 text-sm text-slate">
          Status across upcoming sacrament meetings. Tap a meeting to edit music, speakers, or
          prayers &mdash; this page is a status overview, not a separate editor.
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-rule bg-card p-6">
          <p className="text-sm text-slate">No upcoming sacrament meetings yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.meeting_id}>
              <Link
                href={`/meetings/${r.meeting_id}/planning`}
                className="block rounded-lg border border-rule bg-card p-5 transition-colors hover:border-ink/30"
              >
                <p className="font-display text-lg text-ink">{formatDate(r.date)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge ok={r.core_hymns_set === 3} label={`Hymns ${r.core_hymns_set}/3 set`} />
                  {r.extra_music_count > 0 && (
                    <StatusBadge ok label={`${r.extra_music_count} more music item${r.extra_music_count === 1 ? "" : "s"}`} />
                  )}
                  <StatusBadge
                    ok={r.speakers_confirmed >= 2}
                    label={`Speakers ${r.speakers_confirmed} confirmed`}
                  />
                  <StatusBadge ok={r.prayers_confirmed === 2} label={`Prayers ${r.prayers_confirmed}/2 confirmed`} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}