import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { MEETING_TYPES, MEETINGS } from "@/lib/mock-data";
import type { Meeting, MeetingTypeSlug } from "@/lib/types";

function formatMeetingDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function meetingTypeName(slug: MeetingTypeSlug) {
  return MEETING_TYPES.find((t) => t.slug === slug)?.name ?? slug;
}

function isTypeBuilt(slug: MeetingTypeSlug) {
  return MEETING_TYPES.find((t) => t.slug === slug)?.isBuilt ?? false;
}

function MeetingRow({ meeting }: { meeting: Meeting }) {
  const built = isTypeBuilt(meeting.meetingType);

  const card = (
    <div
      className={[
        "flex flex-col gap-3 rounded-md border px-5 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
        built ? "border-rule bg-card hover:border-ink/30" : "border-rule/60",
      ].join(" ")}
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate/70">
          {meetingTypeName(meeting.meetingType)}
        </p>
        <p className={["font-display text-lg", built ? "text-ink" : "text-ink/40"].join(" ")}>
          {meeting.title}
        </p>
        <p className={built ? "text-sm text-slate" : "text-sm text-slate/60"}>
          {formatMeetingDate(meeting.date)}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <LifecycleBadge stage={meeting.stage} />
        {!built && (
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-slate/70">
            Coming soon
          </span>
        )}
      </div>
    </div>
  );

  if (!built) {
    // Not yet a real workflow — render inert, no link.
    return <li>{card}</li>;
  }

  return (
    <li>
      <Link href={`/meetings/${meeting.id}`} className="block">
        {card}
      </Link>
    </li>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Single Ward" />

      <section className="mt-10">
        <p className="font-mono text-xs uppercase tracking-widest text-slate">Meetings</p>

        <ul className="mt-4 flex flex-col gap-3">
          {MEETINGS.map((meeting) => (
            <MeetingRow key={meeting.id} meeting={meeting} />
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
