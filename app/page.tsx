import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { WARD_NAME } from "@/lib/config";
import { getTodaysPublishedSacramentMeeting } from "@/lib/data/meetings";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import type { AppRole } from "@/lib/supabase/get-session-user";

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
          {todaysSacramentMeeting && (
            <Tile
              title="Sacrament Meeting Program"
              description="Today's program"
              href={`/meetings/${todaysSacramentMeeting.id}/public`}
            />
          )}
          <Tile title="Announcements" description="Ward-wide announcements" href="/announcements/public" />
          <Tile
            title="Youth Activities"
            description="Planned activities for YW and YM"
            href="/youth-activities"
          />
          <Tile title="Scheduled Events" comingSoon />
        </TileGrid>
      </section>

      {/* Tier 1 -- any logged-in user */}
      {user && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-slate">My meetings</p>
          <TileGrid>
            <Tile title="Meetings" description="Meetings you're part of" href="/dashboard" />
          </TileGrid>
        </section>
      )}

      {/* Tier 3 -- music coordinator + bishopric */}
      {isMusicPlanner && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-slate">Music</p>
          <TileGrid>
            <Tile title="Sacrament Music Planning" description="Enter upcoming hymns and music" href="/music" />
            <Tile title="Music Coordination" comingSoon />
          </TileGrid>
        </section>
      )}

      {/* Tier 3 -- youth leaders + bishopric (edit access; page itself handles the split) */}
      {isYouthLeader && !isBishopric && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-slate">Youth program</p>
          <TileGrid>
            <Tile title="Teaching Calendar" comingSoon />
          </TileGrid>
        </section>
      )}

      {/* Tier 4 -- bishopric only */}
      {isBishopric && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-slate">Administration</p>
          <TileGrid>
            <Tile title="Callings" description="Manage callings and holders" href="/callings" />
            <Tile
              title="Manage Announcements"
              description="Review and publish submissions"
              href="/announcements"
            />
            <Tile title="Speaker & Prayer History" comingSoon />
            <Tile
              title="Assignment Rotations"
              description="Who's next for prayers, chorister, etc."
              href="/rotations"
            />
          </TileGrid>
        </section>
      )}

      <footer className="mt-auto pt-16 text-xs text-slate">
        Ward OS &mdash; Heritage Ward &mdash; Syracuse Utah Stake
      </footer>
    </main>
  );
}