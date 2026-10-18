import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getYouthActivityCancellations } from "@/lib/data/youth-activity-cancellations";
import { YOUTH_ACTIVITY_GROUPS } from "@/lib/data/youth-activity-constants";
import {
  addYouthActivityCancellationAction,
  deleteYouthActivityCancellationAction,
} from "@/app/youth-activity-cancellations/actions";

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function YouthActivityCancellationsPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!hasFeature(profile, "youth_activity_planning")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="All-Youth Activity Cancellations" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to manage activity cancellations.</p>
      </main>
    );
  }

  const cancellations = await getYouthActivityCancellations();

  const add = async (formData: FormData) => {
    "use server";
    await addYouthActivityCancellationAction(formData);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="All-Youth Activity Cancellations" />

      <Link href="/youth-activity-planning" className="text-xs text-ink-muted hover:text-ink">
        &larr; Youth Activity Planning
      </Link>

      <section className="mt-4">
        <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">All-Youth Activity Cancellations</h1>
        <p className="mt-2 text-sm text-ink-muted">
          A date range, a reason, and which youth groups it cancels &mdash; leave every group
          unchecked to cancel all of them for that range. Shown with the reason as a note rather
          than hidden, same as Meeting Cancellations. Use this for Family Week, Pioneer Day,
          Thanksgiving, Christmas, New Year&rsquo;s Eve, or any other week with no youth activity.
          Already-cancelled rows are never touched, so a manual cancellation (or un-cancelling one
          afterward) is always safe.
        </p>
      </section>

      <div className="rounded border border-rule bg-surface p-6">
        <h2 className="font-display text-xl">Scheduled Cancellations</h2>

        {cancellations.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">None scheduled yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {cancellations.map((c) => {
              const remove = async () => {
                "use server";
                await deleteYouthActivityCancellationAction(c.id);
              };
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-rule/60 px-3 py-2 text-sm"
                >
                  <span className="text-ink">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">{c.reason}</span>{" "}
                    {formatDate(c.start_date)}
                    {c.end_date !== c.start_date ? ` – ${formatDate(c.end_date)}` : ""}
                    <span className="text-ink-muted">
                      {" "}
                      &middot; {c.group_names.length > 0 ? c.group_names.join(", ") : "All groups"}
                    </span>
                  </span>
                  <form action={remove}>
                    <button type="submit" className="text-xs text-danger/70 hover:text-danger">
                      Delete
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded border border-rule bg-surface p-6">
        <h2 className="font-display text-xl">Add Cancellation</h2>
        <form action={add} className="mt-4 flex flex-col gap-3">
          <label className="text-sm text-ink-muted">
            Reason
            <input
              type="text"
              name="reason"
              required
              placeholder="Family Week, Pioneer Day, Thanksgiving, etc."
              className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink-muted">
              Start Date
              <input
                type="date"
                name="start_date"
                required
                className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="text-sm text-ink-muted">
              End Date
              <input
                type="date"
                name="end_date"
                required
                className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>
          </div>

          <fieldset className="rounded border border-rule px-3 py-2">
            <p className="text-xs text-ink-muted">
              Cancel only these groups for the date range above (leave all unchecked to cancel every group)
            </p>
            <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {YOUTH_ACTIVITY_GROUPS.map((g) => (
                <label key={g.value} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name="group_names" value={g.value} />
                  {g.label}
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            className="w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep"
          >
            Add Cancellation
          </button>
        </form>
      </div>
    </main>
  );
}
