import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getMeetingCancellations } from "@/lib/data/meeting-cancellations";
import { MEETING_TYPE_LABELS, type MeetingTypeSlug } from "@/lib/types";
import { addMeetingCancellationAction, deleteMeetingCancellationAction } from "@/app/meeting-cancellations/actions";

const ALL_MEETING_TYPES: MeetingTypeSlug[] = [
  "sacrament-meeting",
  "bishopric-meeting",
  "ward-council",
  "youth-council",
];

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function MeetingCancellationsPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Meeting Cancellations" />
        <p className="mt-10 text-slate">Only the Bishopric can manage meeting cancellations.</p>
      </main>
    );
  }

  const cancellations = await getMeetingCancellations();

  const add = async (formData: FormData) => {
    "use server";
    await addMeetingCancellationAction(formData);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Meeting Cancellations" />

      <section className="mt-4">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">Meeting Cancellations</h1>
        <p className="mt-2 text-sm text-slate">
          A date range, a reason, and which meeting types (and optionally youth activities) get
          cancelled for it &mdash; shown with the reason as a note, not hidden. Use this for General
          Conference, Stake Conference, holidays, or anything else where some meetings still happen
          that day but others don&rsquo;t. For General Conference, set the start date to the Monday of
          its week and the end date to its closing Sunday. Already-cancelled rows are never touched,
          so a manual cancellation (or un-cancelling one afterward) is always safe.
        </p>
      </section>

      <div className="rounded-lg border border-rule bg-card p-6">
        <h2 className="font-display text-xl">Scheduled Cancellations</h2>

        {cancellations.length === 0 ? (
          <p className="mt-4 text-sm text-slate">None scheduled yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {cancellations.map((c) => {
              const remove = async () => {
                "use server";
                await deleteMeetingCancellationAction(c.id);
              };
              const affected = [
                ...c.meeting_type_slugs.map((slug) => MEETING_TYPE_LABELS[slug] ?? slug),
                ...(c.cancel_youth_activities ? ["Youth Activities"] : []),
              ];
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rule/60 px-3 py-2 text-sm"
                >
                  <span className="text-ink">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-slate/70">{c.reason}</span>{" "}
                    {formatDate(c.start_date)}
                    {c.end_date !== c.start_date ? ` – ${formatDate(c.end_date)}` : ""}
                    {affected.length > 0 && <span className="text-slate"> &mdash; {affected.join(", ")}</span>}
                  </span>
                  <form action={remove}>
                    <button type="submit" className="text-xs text-slate hover:text-ink">
                      Delete
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-rule bg-card p-6">
        <h2 className="font-display text-xl">Add Cancellation</h2>
        <form action={add} className="mt-4 flex flex-col gap-3">
          <label className="text-sm text-slate">
            Reason
            <input
              type="text"
              name="reason"
              required
              placeholder="General Conference, Stake Conference, Independence Day, etc."
              className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate">
              Start Date
              <input
                type="date"
                name="start_date"
                required
                className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="text-sm text-slate">
              End Date
              <input
                type="date"
                name="end_date"
                required
                className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>
          </div>

          <fieldset className="rounded-md border border-rule px-3 py-2">
            <p className="text-xs text-slate">Cancel these meeting types for the date range above</p>
            <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {ALL_MEETING_TYPES.map((slug) => (
                <label key={slug} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name="meeting_type_slugs" value={slug} />
                  {MEETING_TYPE_LABELS[slug]}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="cancel_youth_activities" />
            Also cancel youth activities in this date range
          </label>

          <button
            type="submit"
            className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
          >
            Add Cancellation
          </button>
        </form>
      </div>
    </main>
  );
}
