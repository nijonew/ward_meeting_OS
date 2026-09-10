import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getMeetingTypes } from "@/lib/data/meetings";
import { getVisibleMeetingTypesForUser } from "@/lib/data/meeting-type-access";
import { submitAgendaItem } from "@/app/submit/actions";
import { AgendaItemForm } from "@/components/submit/AgendaItemForm";

/**
 * Agenda item submission, moved here from the old public /submit page
 * and put behind login (2026-09-09) per the user's request: "make it
 * available only to those who attend meetings." Reached from the
 * landing page's "My meetings" section rather than a Tier-0 public
 * tile now -- reusing the exact same calling-based resolution
 * (getVisibleMeetingTypesForUser) that decides which meeting-type
 * tiles show up there, so "attends a meeting" means the same thing in
 * both places: Bishopric attends (and manages) every type; everyone
 * else only the type(s) their current calling maps to via
 * meeting_type_members. The <select> here is filtered to exactly that
 * list, and submitAgendaItem re-checks it server-side too -- the list
 * isn't just a UI convenience, it's the real access boundary now that
 * this isn't "anyone with the link" anymore.
 */
export default async function SubmitAgendaItemPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { success, error } = await searchParams;
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  const isBishopric = profile?.role === "bishopric";
  const allowedTypes = isBishopric ? null : await getVisibleMeetingTypesForUser(user.id);

  const meetingTypes = (await getMeetingTypes()).filter(
    (t) => t.slug !== "sacrament-meeting" && (allowedTypes === null || allowedTypes.includes(t.slug))
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Submit Agenda Item" />

      <section className="mt-10">
        <h1 className="font-display text-2xl">Submit an Agenda Item</h1>
        <p className="mt-2 text-sm text-ink-muted">
          For a meeting you attend by calling. It goes straight onto that meeting&rsquo;s agenda
          &mdash; the Bishopric can remove it afterward if needed.
        </p>

        {meetingTypes.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            No meeting you attend by calling currently accepts agenda items here. Ask the Bishopric
            if you think this is wrong.
          </p>
        ) : (
          <>
            {success && (
              <p className="mt-4 rounded-md border border-rule bg-surface p-4 text-sm text-ink">
                Thanks &mdash; your agenda item has been added.
              </p>
            )}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <AgendaItemForm meetingTypes={meetingTypes} onSubmit={submitAgendaItem} />
          </>
        )}
      </section>
    </main>
  );
}
