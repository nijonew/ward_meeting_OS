import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { MEETING_TYPES, UPCOMING_MEETING } from "@/lib/mock-data";

function formatMeetingDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function HomePage() {
  const meeting = UPCOMING_MEETING;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Single Ward" />

      <section className="mt-10">
        <p className="font-mono text-xs uppercase tracking-widest text-slate">This week</p>

        <div className="mt-4 rounded-lg border border-rule bg-card p-6 sm:p-8">
          <h1 className="font-display text-3xl leading-tight sm:text-4xl">{meeting.title}</h1>
          <p className="mt-1 text-slate">{formatMeetingDate(meeting.date)}</p>

          <div className="mt-6 overflow-x-auto pb-1">
            <LifecycleBadge stage={meeting.stage} />
          </div>

          <Link
            href="/dashboard"
            className="mt-8 inline-flex items-center rounded-md bg-ink px-5 py-2.5 font-body text-sm font-medium text-paper transition-colors hover:bg-ink/90"
          >
            Open this week&rsquo;s meeting
          </Link>
        </div>
      </section>

      <section className="mt-12">
        <p className="font-mono text-xs uppercase tracking-widest text-slate">Meeting types</p>

        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MEETING_TYPES.map((type) => (
            <li
              key={type.slug}
              className={[
                "flex items-center justify-between rounded-md border px-4 py-3",
                type.isBuilt ? "border-rule bg-card" : "border-rule/60",
              ].join(" ")}
            >
              <span className={type.isBuilt ? "text-ink" : "text-ink/40"}>{type.name}</span>
              {!type.isBuilt && (
                <span className="font-mono text-[10px] uppercase tracking-widest text-slate/70">
                  Coming soon
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto pt-16 text-xs text-slate">
        Ward Meeting OS &mdash; planning, conducting, and publishing meetings from one source of
        truth.
      </footer>
    </main>
  );
}
