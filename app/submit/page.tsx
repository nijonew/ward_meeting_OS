import { submitAnnouncement, submitAgendaItem } from "@/app/submit/actions";
import { AppHeader } from "@/components/AppHeader";
import { getMeetingTypes } from "@/lib/data/meetings";
import { SubmitForm } from "@/components/submit/SubmitForm";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { success, error } = await searchParams;

  const meetingTypes = (await getMeetingTypes()).filter((t) => t.slug !== "sacrament-meeting");

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Submit" />

      <section className="mt-10">
        <h1 className="font-display text-2xl">Submit an Announcement or Agenda Item</h1>
        <p className="mt-2 text-sm text-slate">
          Anyone can submit. Both agenda items and announcements go live right away &mdash; the
          Bishopric can remove either afterward if needed.
        </p>

        {success && (
          <p className="mt-4 rounded-md border border-rule bg-card p-4 text-sm text-ink">
            Thanks &mdash; your submission has been received.
          </p>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <SubmitForm
          meetingTypes={meetingTypes}
          onSubmitAnnouncement={submitAnnouncement}
          onSubmitAgendaItem={submitAgendaItem}
        />
      </section>
    </main>
  );
}
