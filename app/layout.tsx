import { notFound } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { getMeetingById } from "@/lib/data/meetings";

function formatMeetingDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const SACRAMENT_TABS = [
  { slug: "planning", label: "Planning" },
  { slug: "conducting", label: "Conducting" },
  { slug: "public", label: "Public" },
] as const;

const COLLABORATIVE_TABS = [
  { slug: "template", label: "Template" },
  { slug: "planning", label: "Planning" },
  { slug: "live", label: "Live" },
] as const;

/**
 * Shared shell for everything under /meetings/[id]/*. Renders the meeting
 * card (title, date, lifecycle badge) and the tab nav once. Sacrament
 * Meeting uses Planning/Conducting/Public; Bishopric Meeting, Ward
 * Council, and Youth Council -- collaborative meetings among invited
 * people, not a single conductor reading a script to a congregation --
 * use Template/Planning/Live instead. Deliberately does NOT require
 * sign-in here -- Public View must work with no login at all. Planning,
 * Template, and Conducting gate themselves individually instead.
 */
export default async function MeetingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meeting = await getMeetingById(id);

  if (!meeting) {
    notFound();
  }

  const tabs = meeting.meetingType === "sacrament-meeting" ? SACRAMENT_TABS : COLLABORATIVE_TABS;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader tag={meeting.title} />

      <section className="mt-10 rounded-lg border border-rule bg-card p-6 sm:p-8">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{meeting.title}</h1>
        <p className="mt-1 text-slate">{formatMeetingDate(meeting.date)}</p>

        <div className="mt-6 overflow-x-auto pb-1">
          <LifecycleBadge stage={meeting.stage} />
        </div>
      </section>

      <nav className="mt-6 flex gap-1 border-b border-rule">
        {tabs.map((tab) => (
          <Link
            key={tab.slug}
            href={`/meetings/${meeting.id}/${tab.slug}`}
            className="border-b-2 border-transparent px-4 py-2 font-mono text-xs uppercase tracking-widest text-slate transition-colors hover:text-ink"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8 flex-1">{children}</div>

      <footer className="mt-auto pt-16 text-xs text-slate">
        Ward Meeting OS &mdash; planning, conducting, and publishing meetings from one source of
        truth.
      </footer>
    </main>
  );
}