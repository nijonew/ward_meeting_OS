import { submitItem } from "@/app/submit/actions";
import { AppHeader } from "@/components/AppHeader";

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
        <h1 className="font-display text-2xl">Submit an Announcement or Agenda Item</h1>
        <p className="mt-2 text-sm text-slate">
          Anyone can submit &mdash; the Bishopric reviews everything before it&rsquo;s published.
        </p>

        {success && (
          <p className="mt-4 rounded-md border border-rule bg-card p-4 text-sm text-ink">
            Thanks &mdash; your submission has been sent to the Bishopric for review.
          </p>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <form action={submitItem} className="mt-6 flex flex-col gap-3">
          <fieldset className="flex gap-4 text-sm text-slate">
            <label className="flex items-center gap-2">
              <input type="radio" name="kind" value="announcement" defaultChecked /> Announcement
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="kind" value="agenda_item" /> Agenda Item
            </label>
          </fieldset>

          <input
            type="text"
            name="submitted_by_name"
            required
            placeholder="Your name"
            className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
          <input
            type="email"
            name="submitted_by_email"
            required
            placeholder="Your email"
            className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
          <input
            type="text"
            name="title"
            required
            placeholder="Title"
            className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
          <textarea
            name="body"
            rows={4}
            placeholder="Details"
            className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />

          <button
            type="submit"
            className="mt-1 w-fit rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
          >
            Submit
          </button>
        </form>
      </section>
    </main>
  );
}
