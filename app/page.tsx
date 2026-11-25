import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getTodaysPublishedSacramentMeeting, getEarlyAccessSacramentMeeting } from "@/lib/data/meetings";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getNavSections } from "@/lib/data/nav-sections";

// Per the user's request (2026-09-09): the landing page's browser tab
// now reads "Dashboard" and /dashboard's reads "Meeting Dashboard" (see
// that page's own metadata) -- distinct on purpose, since the user was
// confused about which page was actually "the dashboard page."
export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * The single landing page for everyone -- ward members, meeting
 * participants, youth leaders, music coordinators, and admins all land
 * here. Tiles are filtered in or out below based on login state and
 * whichever granular features the signed-in account's callings grant
 * (2026-10-04, replacing the old role-based gating entirely -- see
 * PROJECT_CONTEXT.md's Architecture section); tapping a tile navigates
 * to that feature's own existing page.
 */
export default async function HomePage() {
  const { user, profile } = await getSessionUser();

  const todaysSacramentMeeting = await getTodaysPublishedSacramentMeeting();
  // Early-access second path (2026-10-24, see getEarlyAccessSacramentMeeting's
  // own doc comment for the bug this fixes) -- only queried when
  // today's own meeting isn't up yet, and only for someone who could
  // actually use the result; a logged-out visitor or an account
  // without the feature keeps seeing the exact same "Published on
  // meeting day" comingSoon tile as before.
  const canPreviewSacramentEarly = hasFeature(profile, "sacrament_program_view");
  const earlyAccessSacramentMeeting =
    !todaysSacramentMeeting && canPreviewSacramentEarly ? await getEarlyAccessSacramentMeeting() : null;

  // My meetings/My calling/Admin --
  // factored out into `getNavSections()` (2026-11-05, built for the new
  // persistent side nav) rather than re-derived here a second time, per
  // this app's own "Single Source of Truth" principle. "This week"
  // (above) stays hand-written on this page -- see that function's own
  // doc comment for why it isn't shared.
  const navSections = await getNavSections();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader />

      {/* The ward name used to repeat here as its own <h1>, directly
          below AppHeader's own "<ward name> Ward" wordmark -- removed
          2026-11-08 (the user's own report: "it is at the top of the
          page twice... keep it in the header but remove it from the
          top of the mid section"). This section now only ever renders
          the sign-in status messages below, when there's one to show. */}
      <section className="mt-10">
        {/* Expanded, 2026-11-14 (the user's own request): "a note...
            that says something to the effect of them needing to log
            in and be verified by an admin to view tools other than
            sacrament meeting programs and announcements." The old,
            shorter line ("Sign in for meeting and planning tools")
            never mentioned the admin-verification step at all, which
            is the real reason a freshly signed-up account doesn't see
            anything yet -- someone could otherwise sign in, see
            nothing happened, and assume it's broken. */}
        {!user && (
          <p className="text-sm text-ink-muted">
            Sign in for meeting and planning tools. After signing in, an admin still needs
            to verify your account before you can see anything beyond the Sacrament
            Meeting Program and Announcements above.
          </p>
        )}
        {user && !profile?.isLinked && (
          <p className="text-sm text-ink-muted">
            You&rsquo;re signed in, but an admin still needs to verify your account before you
            have access to anything else.
          </p>
        )}
      </section>

      {/* Tier 0 -- everyone, no login required */}
      <section className="mt-8">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">This week</p>
        <TileGrid>
            {/* prefetch (2026-11-14, pre-launch performance pass) --
                this whole tier is a small, fixed 3-4 tiles, the very
                first thing every visitor clicks; see Tile.tsx's own
                comment for why this is a safe exception to the
                2026-10-12 "every tile defaults to no prefetch" fix. */}
            {todaysSacramentMeeting ? (
              <Tile
                title="Sacrament Meeting Program"
                href={`/meetings/${todaysSacramentMeeting.id}/public`}
                prefetch
              />
            ) : earlyAccessSacramentMeeting ? (
              <Tile
                title="Sacrament Meeting Program"
                href={`/meetings/${earlyAccessSacramentMeeting.id}/public`}
                prefetch
              />
            ) : (
              <Tile
                title="Sacrament Meeting Program"
                comingSoon
                disabledLabel="Available on the day of the meeting"
              />
            )}
          <Tile title="Announcements" href="/announcements/public" prefetch />
          {/* Ward Calendar View, 2026-11-01 -- public, no login, same
              tier as the two tiles above (scoped via AskUserQuestion:
              "Public, no login" + "Everything public"). */}
          <Tile title="Calendar" href="/calendar" prefetch />
          {/* Requires login (2026-10-07, the user's own request) --
              unlike the rest of this tier, grayed out with a specific
              reason rather than "Coming soon" for a logged-out
              visitor, since the feature exists and works, it's just
              gated. The page itself (app/youth-activities/page.tsx)
              enforces the same requirement server-side; this tile
              alone wouldn't stop someone from typing the URL.
              **Tightened from "logged in" to "verified," 2026-11-25**
              (a real reported gap: a signed-up-but-not-yet-verified
              account could reach this with no admin having linked them
              to a person yet) -- gates on `profile?.isLinked` now, not
              plain `user`, with its own distinct grayed-out message for
              the "logged in but not verified" case. */}
          {/* `readonly=1` (2026-10-12, the user's own request: "leave
              everything in the 'This Week' section read only") -- the
              other two tiles in this tier were already read-only with
              no further management reachable from them (the public
              program page, and the public announcements listing have
              no admin controls at all), but Youth Activities' own hub
              page shows a Manage tile (and the three Combined-group
              pages render real Add/Edit/Overwrite controls inline) for
              any account holding youth_activity_planning -- this flag
              suppresses all of that for this one entry point, mirroring
              /dashboard's own readonly convention. An account that
              actually needs to manage activities still reaches full
              access the normal way, via "My calling" -> Youth
              Activity Planning -> Manage (moved there from its own
              "Youth program" section 2026-11-14, see
              lib/data/nav-sections.ts's own comment). */}
          <Tile
            title="Youth Activities"
            href={profile?.isLinked ? "/youth-activities?readonly=1" : undefined}
            disabledLabel={
              profile?.isLinked
                ? undefined
                : user
                  ? "An admin still needs to verify your account"
                  : "Please log in to see youth activities"
            }
            prefetch={Boolean(profile?.isLinked)}
          />
          {/* "Scheduled Events" (the merged Youth Activities + Ward
              Events listing, /events) removed from the landing page
              2026-10-07 per the user's own request -- Ward Events
              overlapped with Announcements/Youth Activities and
              "can go." Scoped to just this tile for now: /events and
              /ward-events themselves, and all of Ward Events' admin
              tooling, are untouched and still reachable directly, in
              case this needs to come back without rebuilding anything. */}
          {/* Both read-only Lessons pages moved here from "My
              meetings" (getNavSections()), 2026-11-14 -- the user's
              own request: "move the viewable lessons for youth and
              adults into This Week. Recall that the youth items are
              only to be viewed when logged in." Same grayed-out-with-
              a-reason treatment as Youth Activities right above, not
              a plain dead link, since both pages already require a
              signed-in session on their own.
              **Tightened to require verification, 2026-11-25**, same
              fix/reasoning as the Youth Activities tile right above --
              both pages now also check `profile?.isLinked`. */}
          <Tile
            title="YM/YW Lessons"
            href={profile?.isLinked ? "/ym-yw-lessons" : undefined}
            disabledLabel={
              profile?.isLinked
                ? undefined
                : user
                  ? "An admin still needs to verify your account"
                  : "Please log in to see YM/YW lessons"
            }
            prefetch={Boolean(profile?.isLinked)}
          />
          <Tile
            title="Elders Quorum / Relief Society Lessons"
            href={profile?.isLinked ? "/adult-teaching-lessons" : undefined}
            disabledLabel={
              profile?.isLinked
                ? undefined
                : user
                  ? "An admin still needs to verify your account"
                  : "Please log in to see Elders Quorum / Relief Society lessons"
            }
            prefetch={Boolean(profile?.isLinked)}
          />
        </TileGrid>
      </section>

      {/* My meetings/My calling/Admin, 2026-11-05 --
          sourced from `getNavSections()` (lib/data/nav-sections.ts)
          instead of being hand-rolled here; see that function's own
          doc comment for the per-section gating this loop no longer
          needs to repeat. Order matches the function's own push order
          (My meetings, My calling, Admin), same reading order this
          page always had. "Youth program" was its own section here
          through 2026-11-14, when it was eliminated -- its one link
          (Youth Activity Planning) moved into "My calling" instead.
          "Announcements" was its own section through 2026-11-15, when
          it was eliminated the same way, per the user's own request --
          both of its links (Submit an Announcement, Manage
          Announcements) moved into "My calling" too. */}
      {navSections.map((section) => (
        <section key={section.title} className="mt-10">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">{section.title}</p>
          <TileGrid>
            {section.links.map((link) => (
              <Tile key={link.href} title={link.title} href={link.href} />
            ))}
          </TileGrid>
        </section>
      ))}

      <footer className="mt-auto pt-16 text-xs text-ink-muted">
        Ward OS &mdash; Heritage Ward &mdash; Syracuse Utah Stake
      </footer>
    </main>
  );
}