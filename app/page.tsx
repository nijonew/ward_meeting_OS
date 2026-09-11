import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getTodaysPublishedSacramentMeeting } from "@/lib/data/meetings";
import { getVisibleMeetingTypesForUser } from "@/lib/data/meeting-type-access";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import type { AppRole } from "@/lib/supabase/get-session-user";
import { MEETING_TYPE_LABELS, type MeetingTypeSlug } from "@/lib/types";

// Visual redesign (design.md, direction "The Ledger"). The spine
// (church-meeting-management shape, adapted to this app): current
// meeting/week context -> thesis moment -> meetings you plan ->
// announcements & events -> your area of responsibility -> broader
// admin tools -> one primary action -> footer.
//
// Motion is "Calm" (see .rise-in in globals.css), applied only to the
// hero -- the one region guaranteed to be in view on load. Phase 2
// originally staggered a rise-in across every section below it too,
// but on a page this tall that motion finishes before anyone scrolls
// far enough to see it: pure wasted code, invisible in practice. Phase
// 5's restraint pass cut it rather than build scroll-triggered reveals
// to make it "work" -- a static section that appears the instant it's
// scrolled to communicates just as well and is simpler.
//
// Copy note: existing functional labels (tile titles, descriptions,
// section eyebrows) were already real app content before this
// redesign, so they're untouched -- the words this redesign actually
// introduced (the hero's supporting sentences, the primary-action
// line) were written in Phase 3. The hero visual is a hand-built inline
// SVG per design.md's Assets plan (Phase 4) -- no photography, no
// stock imagery, no generated illustration.

const ALL_MEETING_TYPES: MeetingTypeSlug[] = ["bishopric-meeting", "ward-council", "youth-council"];

export const metadata: Metadata = {
  title: "Dashboard",
};

const YOUTH_LEADER_ROLES: AppRole[] = [
  "yw_presidency",
  "yw_advisor",
  "yw_specialist",
  "ym_advisor",
  "ym_specialist",
];

export default async function HomePage() {
  const { user, profile } = await getSessionUser();
  const role = profile?.role ?? null;

  const isBishopric = role === "bishopric";
  const isMusicPlanner = role === "music_planner" || isBishopric;
  const isYouthLeader = (role && YOUTH_LEADER_ROLES.includes(role)) || isBishopric;

  const todaysSacramentMeeting = await getTodaysPublishedSacramentMeeting();

  const rawVisibleTypes = user && !isBishopric ? await getVisibleMeetingTypesForUser(user.id) : [];
  const visibleMeetingTypes = isBishopric ? ALL_MEETING_TYPES : rawVisibleTypes;
  const attendsMeetings = isBishopric || rawVisibleTypes.length > 0;

  // Single most relevant next step for the primary-action band -- kept
  // to one honest option rather than forcing something for every
  // session state. See the file comment above.
  const primaryAction = !user
    ? {
        label: "Sign in",
        href: "/login",
        note: "Sign in for your meeting and planning tools.",
      }
    : isBishopric
      ? {
          label: "Open Meeting Planning",
          href: "/meeting-planning",
          note: "Agendas, the schedule, and rotations are one click away.",
        }
      : isMusicPlanner
        ? {
            label: "Open Music Planning",
            href: "/music",
            note: "Keep hymns and music filled in for what's coming up.",
          }
        : isYouthLeader
          ? {
              label: "Open Youth Teaching Planning",
              href: "/youth-teaching-planning",
              note: "Sunday teaching assignments for your class are waiting.",
            }
          : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12 sm:px-8">
      <AppHeader />

      {/* 1 & 2 -- current meeting/week context, then the thesis moment */}
      <section className="rise-in mt-10">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">Today</p>

        {todaysSacramentMeeting ? (
          <Link
            href={`/meetings/${todaysSacramentMeeting.id}/public`}
            className="mt-3 flex flex-col rounded border border-rule bg-surface px-6 py-5 transition-colors hover:border-rule-strong"
          >
            <span className="font-display text-xl font-semibold text-ink sm:text-2xl">
              Sacrament Meeting Program
            </span>
            <span className="mt-1 text-sm text-ink-muted">Today&rsquo;s program</span>
          </Link>
        ) : (
          <div className="mt-3 flex flex-col rounded border border-rule/60 px-6 py-5">
            <span className="font-display text-xl font-semibold text-ink/40 sm:text-2xl">
              Sacrament Meeting Program
            </span>
            <span className="mt-1 text-sm text-ink-muted/60">Published on meeting day</span>
          </div>
        )}

        <h1 className="mt-6 font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
          Efficient enough for a volunteer&rsquo;s spare hour, quiet enough for Sunday morning.
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          Rotations, templates, and prior planning are already filled in. A leader&rsquo;s own
          time goes to what only a person can add, not to rebuilding what&rsquo;s already
          settled. Everyone else sees the same information back, plainly, when they need it.
        </p>

        {/* Assets plan (design.md): a quiet ledger-line motif -- an
            abstraction of "an ordered list," which is what the app
            actually is. Hand-built inline SVG, no photography, no
            illustration of a person or building. The first row is
            drawn emphasized (filled index chip, heavier rule) the same
            way the signature element marks a current/next item
            elsewhere in the app; the rest sit quiet. */}
        <svg
          viewBox="0 0 720 200"
          className="mt-6 h-24 w-full sm:h-32"
          role="img"
          aria-hidden="true"
        >
          <rect x="0" y="18" width="14" height="14" rx="2" fill="var(--color-accent)" />
          <rect x="28" y="21" width="420" height="8" rx="4" fill="var(--color-rule-strong)" />

          <rect x="0" y="54" width="14" height="14" rx="2" fill="none" stroke="var(--color-rule-strong)" strokeWidth="1.5" />
          <rect x="28" y="57" width="560" height="8" rx="4" fill="var(--color-rule)" />

          <rect x="0" y="90" width="14" height="14" rx="2" fill="none" stroke="var(--color-rule-strong)" strokeWidth="1.5" />
          <rect x="28" y="93" width="300" height="8" rx="4" fill="var(--color-rule)" />

          <rect x="0" y="126" width="14" height="14" rx="2" fill="none" stroke="var(--color-rule-strong)" strokeWidth="1.5" />
          <rect x="28" y="129" width="480" height="8" rx="4" fill="var(--color-rule)" />

          <rect x="0" y="162" width="14" height="14" rx="2" fill="none" stroke="var(--color-rule-strong)" strokeWidth="1.5" />
          <rect x="28" y="165" width="380" height="8" rx="4" fill="var(--color-rule)" />
        </svg>
      </section>

      {/* 3 -- meeting planning / assignments */}
      {user && visibleMeetingTypes.length > 0 && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">My meetings</p>
          <TileGrid>
            {visibleMeetingTypes.map((slug) => (
              <Tile
                key={slug}
                title={MEETING_TYPE_LABELS[slug]}
                href={`/dashboard?type=${slug}&readonly=1`}
              />
            ))}
            {attendsMeetings && (
              <>
                <Tile
                  title="Meeting Agenda Items"
                  description="Submit an agenda item for a meeting you attend"
                  href="/submit/agenda-item"
                />
                <Tile
                  title="Submit an Announcement"
                  description="Share something with the ward"
                  href="/submit/announcement"
                />
              </>
            )}
          </TileGrid>
        </section>
      )}

      {/* 4 -- announcements / important information */}
      <section className="mt-10">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">Announcements &amp; events</p>
        <TileGrid>
          <Tile title="Announcements" description="Ward-wide announcements" href="/announcements/public" />
          <Tile
            title="Youth Activities"
            description="Planned activities for YW and YM"
            href="/youth-activities"
          />
          <Tile title="Scheduled Events" description="Youth and ward events" href="/events" />
        </TileGrid>
      </section>

      {/* 5 -- people / responsibilities */}
      {isMusicPlanner && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">Music</p>
          <TileGrid>
            <Tile
              title="Sacrament Meeting Music Planning"
              description="Enter and plan upcoming hymns and music"
              href="/music"
            />
          </TileGrid>
        </section>
      )}

      {isYouthLeader && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">Youth program</p>
          <TileGrid>
            <Tile
              title="Youth Teaching Planning"
              description="Sunday teaching assignments for your class"
              href="/youth-teaching-planning"
            />
            <Tile
              title="Youth Activity Planning"
              description="Plan and manage upcoming youth activities"
              comingSoon
            />
          </TileGrid>
        </section>
      )}

      {/* 6 -- supporting meeting tools */}
      {isBishopric && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">Administration</p>
          <TileGrid>
            <Tile
              title="Meeting Planning"
              description="Meeting agendas, schedule, cancellations, and rotations"
              href="/meeting-planning"
            />
            <Tile
              title="Calling Planning"
              description="One row per calling change: candidates, status, release, and readiness to announce"
              href="/calling-planning"
            />
            <Tile
              title="Manage Announcements"
              description="Review and publish submissions"
              href="/announcements"
            />
            <Tile title="Table Admin" description="Direct edit access to raw data tables" href="/admin" />
          </TileGrid>
        </section>
      )}

      {/* 7 -- one primary action */}
      {primaryAction && (
        <section className="mt-10 flex flex-col items-start gap-2 border-t border-rule pt-8">
          <p className="max-w-prose text-sm text-ink-muted">{primaryAction.note}</p>
          <Link
            href={primaryAction.href}
            className="inline-flex items-center rounded bg-accent px-5 py-2.5 font-body text-sm font-medium text-surface transition-colors hover:bg-accent-deep"
          >
            {primaryAction.label}
          </Link>
        </section>
      )}

      {/* 8 -- footer / navigation */}
      <footer className="mt-auto pt-16 text-xs text-ink-muted">
        Ward OS &middot; Heritage Ward &middot; Syracuse Utah Stake
      </footer>
    </main>
  );
}
