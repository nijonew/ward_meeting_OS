import { submitAnnouncement } from "@/app/submit/actions";
import { AppHeader } from "@/components/AppHeader";
import { AnnouncementForm } from "@/components/submit/AnnouncementForm";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { success, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Submit" />

      <section className="mt-10">
        <h1 className="font-display text-2xl">Submit an Announcement</h1>
        <p className="mt-2 text-sm text-slate">
          Anyone can submit &mdash; it goes live right away. The Bishopric can remove it afterward
          if needed. Looking to submit a meeting agenda item instead? That&rsquo;s now under your
          own &ldquo;My meetings&rdquo; section once you sign in &mdash; only shown to those who
          attend a meeting by calling.
        </p>

        {success && (
          <p className="mt-4 rounded-md border border-rule bg-card p-4 text-sm text-ink">
            Thanks &mdash; your submission has been received.
          </p>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <AnnouncementForm onSubmit={submitAnnouncement} />
      </section>
    </main>
  );
}
