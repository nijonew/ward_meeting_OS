import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getVisibleMeetingTypesForUser } from "@/lib/data/meeting-type-access";
import { submitAnnouncement } from "@/app/submit/actions";
import { AnnouncementForm } from "@/components/submit/AnnouncementForm";

/**
 * Announcement submission -- moved behind login and calling-gated
 * 2026-09-09, same day and same reasoning as Agenda Item submission
 * (see app/submit/agenda-item/page.tsx and PROJECT_CONTEXT.md): the
 * user's own follow-up was "the same for submitting announcements by
 * moving it to the same location with the same gatekeeping." This
 * reverses the original, deliberate "anyone can submit, no login"
 * design from 2026-09-05 -- a real policy change, not a bug fix, per
 * the user's explicit instruction just now.
 *
 * "Same gatekeeping" here means the same *account-level* check Agenda
 * Item submission uses (attends a meeting by calling, or is Bishopric)
 * -- there's no per-meeting-type access question for an announcement
 * the way there is for an agenda item, so this doesn't filter a
 * dropdown the way that page does; it's a single yes/no page gate.
 *
 * **Bug found and fixed 2026-10-04** (the user's own report: the
 * Communications Specialist role "didn't give them the access I want
 * them to have which would be access to create announcements"): the
 * role was never actually wired into this check at all -- despite its
 * name, a Communications Specialist with no calling-based meeting
 * access (meeting_type_members) was blocked here exactly like anyone
 * else with no calling. Added alongside Bishopric, not folded into
 * the general `attendsMeetings` concept used elsewhere on this page
 * (which also gates unrelated features like Meeting Agenda Items) --
 * see app/page.tsx's own `canSubmitAnnouncement` for the matching
 * landing-page tile fix.
 */
export default async function SubmitAnnouncementPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { success, error } = await searchParams;
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  const canAlwaysSubmit = hasFeature(profile, "bishopric") || hasFeature(profile, "communications_specialist");
  const attendsMeetings = canAlwaysSubmit || (await getVisibleMeetingTypesForUser(user.id, profile?.features)).length > 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Submit Announcement" />

      <section className="mt-10">
        <h1 className="font-display text-2xl">Submit an Announcement</h1>
        <p className="mt-2 text-sm text-ink-muted">
          It goes live right away. The Bishopric can remove it afterward if needed.
        </p>

        {!attendsMeetings ? (
          <p className="mt-4 text-sm text-ink-muted">
            Announcement submission is limited to those who attend a meeting by calling. Ask the
            Bishopric if you think this is wrong.
          </p>
        ) : (
          <>
            {success && (
              <p className="mt-4 rounded border border-rule bg-surface p-4 text-sm text-ink">
                Thanks. Your submission has been received.
              </p>
            )}
            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <AnnouncementForm onSubmit={submitAnnouncement} />
          </>
        )}
      </section>
    </main>
  );
}
