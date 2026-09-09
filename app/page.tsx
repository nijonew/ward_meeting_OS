import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { WARD_NAME } from "@/lib/config";
import { getTodaysPublishedSacramentMeeting } from "@/lib/data/meetings";
import { getVisibleMeetingTypesForUser } from "@/lib/data/meeting-type-access";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import type { AppRole } from "@/lib/supabase/get-session-user";
import { MEETING_TYPE_LABELS, type MeetingTypeSlug } from "@/lib/types";

const ALL_MEETING_TYPES: MeetingTypeSlug[] = [
  "sacrament-meeting",
  "bishopric-meeting",
  "ward-council",
  "youth-council",
];

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
  // Meeting is a deliberate exception (2026-09-08): its live view is
  // exactly the existing public program, already visible with no login
  // or calling at all, so gating the tile itself by calling would add
  // no real access control -- just show it to any logged-in account.
  const rawVisibleTypes = user && !isBishopric ? await getVisibleMeetingTypesForUser(user.id) : [];
  const visibleMeetingTypes = isBishopric
    ? ALL_MEETING_TYPES
    : user
      ? Array.from(new Set(["sacrament-meeting" as const, ...rawVisibleTypes]))
      : [];
  // Distinct from the above -- "sacrament-meeting" is always folded into
  // visibleMeetingTypes for any logged-in account (its tile needs no
  // calling), so that list alone can't tell "attends a meeting" from
  // "just logged in." This is the real, narrower signal the Meeting
  // Agenda Items tile below is gated on (2026-09-09, the user's own
  // request): a calling that maps to Bishopric Meeting/Ward Council/
  // Youth Council, or the Bishopric role itself.
  const attendsMeetings = isBishopric || rawVisibleTypes.length > 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader />

      <section className="mt-10">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{WARD_NAME}</h1>
        {!user && <p className="mt-2 text-slate">Sign in for meeting and planning tools.</p>}
      </section>

      {/* Tier 0 -- everyone, no login required */}
      <section className="mt-8">
        <p className="font-mono text-xs uppercase tracking-widest text-slate">This week</p>
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
          comment above attendsMeetings). */}
      {user && visibleMeetingTypes.length > 0 && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-slate">My meetings</p>
          <TileGrid>
            {visibleMeetingTypes.map((slug) => (
              <Tile
                key={slug}
                title={MEETING_TYPE_LABELS[slug]}
                href={`/dashboard?type=${slug}`}
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
          <p className="font-mono text-xs uppercase tracking-widest text-slate">Music</p>
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
          destination. */}
      {isYouthLeader && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-slate">Youth program</p>
          <TileGrid>
            <Tile
              title="Teaching Calendar"
              description="Sunday teaching assignments for each class"
              href="/teaching-calendar"
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
          <p className="font-mono text-xs uppercase tracking-widest text-slate">Administration</p>
          <TileGrid>
            <Tile
              title="Calling Planning"
              description="One row per calling change: candidates, status, release, and readiness to announce"
              href="/calling-planning"
            />
            <Tile
              title="Meeting Schedule"
              description="Set cadence and generate meetings"
              href="/meeting-schedule"
            />
            <Tile
              title="Meeting Cancellations"
              description="Conferences, holidays, etc. -- auto-cancels affected meetings"
              href="/meeting-cancellations"
            />
            <Tile
              title="Manage Announcements"
              description="Review and publish submissions"
              href="/announcements"
            />
            <Tile
              title="Speaker & Prayer History"
              description="Who's due for a turn"
              href="/speaker-prayer-history"
            />
            <Tile
              title="Assignment Rotations"
              description="Who's next for prayers, chorister, etc."
              href="/rotations"
            />
            <Tile title="Table Admin" description="Direct edit access to raw data tables" href="/admin" />
          </TileGrid>
        </section>
      )}

      <footer className="mt-auto pt-16 text-xs text-slate">
        Ward OS &mdash; Heritage Ward &mdash; Syracuse Utah Stake
      </footer>
    </main>
  );
}