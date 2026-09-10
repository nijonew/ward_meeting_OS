import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { WARD_NAME } from "@/lib/config";
import { getTodaysPublishedSacramentMeeting } from "@/lib/data/meetings";
import { getVisibleMeetingTypesForUser } from "@/lib/data/meeting-type-access";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import type { AppRole } from "@/lib/supabase/get-session-user";
import { MEETING_TYPE_LABELS, type MeetingTypeSlug } from "@/lib/types";

// Sacrament Meeting deliberately excluded (2026-09-10, the user's own
// request: "remove sacrament meeting from 'my meetings'") -- its own
// tile in the "This week" tier above already covers the one thing a
// non-admin would want (today's public program), and admins reach it
// through Administration -> Meeting Planning -> Meeting Agendas
// instead, so a third entry point here was redundant.
const ALL_MEETING_TYPES: MeetingTypeSlug[] = ["bishopric-meeting", "ward-council", "youth-council"];

// Per the user's request (2026-09-09): the landing page's browser tab
// now reads "Dashboard" and /dashboard's reads "Meeting Dashboard" (see
// that page's own metadata) -- distinct on purpose, since the user was
// confused about which page was actually "the dashboard page."
export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * The single landing page for everyone -- ward members, meeting
 * participants, youth leaders, music coordinators, and the bishopric all
 * land here. Tiles are filtered in or out below based on login state and
 * role; tapping a tile navigates to that feature's own existing page.
 * See /areas/ward-meeting-os.md for the full tile/role matrix this
 * implements.
 */

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

  // Admins manage every meeting type regardless of which calling happens
  // to be recorded against their own account; everyone else only sees a
  // tile for a type their calling actually maps to (meeting_type_members)
  // -- per the user's own request (2026-09-06): "only show the meetings
  // that apply to the person by nature of their calling." Sacrament
  // Meeting no longer gets a tile here at all (2026-09-10) -- see
  // ALL_MEETING_TYPES's own comment above.
  const rawVisibleTypes = user && !isBishopric ? await getVisibleMeetingTypesForUser(user.id) : [];
  const visibleMeetingTypes = isBishopric ? ALL_MEETING_TYPES : rawVisibleTypes;
  // This is the same list as visibleMeetingTypes for a non-admin now
  // that Sacrament Meeting isn't unconditionally folded in -- kept as
  // its own named check anyway, since it's a real, distinct concept
  // (attends *some* meeting by calling, or is Bishopric) that the
  // Meeting Agenda Items/Submit an Announcement tiles below are gated
  // on (2026-09-09, the user's own request).
  const attendsMeetings = isBishopric || rawVisibleTypes.length > 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader />

      <section className="mt-10">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{WARD_NAME}</h1>
        {!user && <p className="mt-2 text-ink-muted">Sign in for meeting and planning tools.</p>}
      </section>

      {/* Tier 0 -- everyone, no login required */}
      <section className="mt-8">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">This week</p>
        <TileGrid>
            {todaysSacramentMeeting ? (
              <Tile
                title="Sacrament Meeting Program"
                description="Today's program"
                href={`/meetings/${todaysSacramentMeeting.id}/public`}
              />
            ) : (
              <Tile title="Sacrament Meeting Program" description="Published on meeting day" comingSoon />
            )}
          <Tile title="Announcements" description="Ward-wide announcements" href="/announcements/public" />
          <Tile
            title="Youth Activities"
            description="Planned activities for YW and YM"
            href="/youth-activities"
          />
          <Tile title="Scheduled Events" description="Youth and ward events" href="/events" />
        </TileGrid>
      </section>

      {/* Tier 1 -- any logged-in user, but only meeting types their own
          calling actually maps to (meeting_type_members) -- admins see
          all four regardless. Replaces the old single "Meetings" tile,
          which just linked to /dashboard's unfiltered hodgepodge of
          every meeting type. Meeting Agenda Items and Submit an
          Announcement both moved in here 2026-09-09 (were public
          Tier-0 tiles before) per the user's own request -- both are
          now only shown to accounts that actually attend a meeting by
          calling (attendsMeetings), not to every logged-in account the
          way the rest of this section's tiles are (those always
          include Sacrament Meeting regardless of calling -- see the
          comment above attendsMeetings). Per-type tiles link with
          `readonly=1` (2026-09-09, the user's own request: "make my
          meetings section for read only views of meetings") -- without
          it, a Bishopric account would land on /dashboard's full New
          Meeting/Cancel/Unassigned-Agenda-Items control surface even
          from here; that surface now lives only behind the
          Administration section's own Meeting Planning tile below. */}
      {user && visibleMeetingTypes.length > 0 && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">My meetings</p>
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

      {/* Tier 3 -- music coordinator + bishopric. Was two tiles
          (Sacrament Music Planning + a separate Music Coordination
          status overview) -- merged into one 2026-09-08 per the user's
          own call: the per-meeting Planning view (unified 2026-09-08,
          priority queue item 1 above) already covers everyday status
          for one meeting at a time, so a separate weeks-at-a-glance
          overview page added an entry point without adding a real
          capability. /music-coordination and its data module were
          removed outright, not just unlinked. */}
      {isMusicPlanner && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Music</p>
          <TileGrid>
            <Tile
              title="Sacrament Meeting Music Planning"
              description="Enter and plan upcoming hymns and music"
              href="/music"
            />
          </TileGrid>
        </section>
      )}

      {/* Tier 3 -- youth leaders + bishopric. Was youth-leader-only
          (excluding bishopric) back when this was just a "Coming soon"
          placeholder -- Teaching Calendar itself is meant for "youth
          leaders and admins" per the user (2026-09-08), so the guard
          dropped the !isBishopric exclusion once it had a real
          destination. Renamed to "Youth Teaching Planning" (2026-09-09,
          the user's own request) once it became a per-class hub --
          which class(es) a given account actually sees inside it is a
          separate, narrower question than this role-based tile gate;
          see getAccessibleClasses in lib/data/teaching-assignments.ts. */}
      {isYouthLeader && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Youth program</p>
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

      {/* Tier 4 -- bishopric only */}
      {isBishopric && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Administration</p>
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

      <footer className="mt-auto pt-16 text-xs text-ink-muted">
        Ward OS &mdash; Heritage Ward &mdash; Syracuse Utah Stake
      </footer>
    </main>
  );
}