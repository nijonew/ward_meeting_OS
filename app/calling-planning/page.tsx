import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import {
  getAllCallingPlanningRows,
  getCallingOptions,
  DEFAULT_CALLING_STATUSES,
  DEFAULT_RELEASE_STATUSES,
} from "@/lib/data/calling-planning";
import { getActivePeople } from "@/lib/data/people";
import { getUpcomingMeetings } from "@/lib/data/meetings";
import { getSelectOptions } from "@/lib/data/select-options";
import { createCallingPlanningEntry } from "@/app/calling-planning/actions";
import { CallingPlanningGridForm } from "@/components/calling-planning/CallingPlanningGridForm";
import { PushCallingForm } from "@/components/calling-planning/PushCallingForm";

export default async function CallingPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ calling?: string }>;
}) {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Calling Planning" />
        <p className="mt-10 text-slate">Only the Bishopric can manage calling planning.</p>
      </main>
    );
  }

  const { calling: callingFilter } = await searchParams;

  const [rows, callingOptions, people, meetings, callingStatusOptions, releaseStatusOptions] = await Promise.all([
    getAllCallingPlanningRows(callingFilter),
    getCallingOptions(),
    getActivePeople(),
    getUpcomingMeetings(),
    getSelectOptions("calling_planning.calling_status", DEFAULT_CALLING_STATUSES),
    getSelectOptions("calling_planning.release_status", DEFAULT_RELEASE_STATUSES),
  ]);

  const sacramentMeetings = meetings.filter((m) => m.meetingType === "sacrament-meeting");
  const filteredCallingName = callingFilter ? callingOptions.find((c) => c.id === callingFilter)?.name : null;

  const readyToAnnounce = rows.filter(
    (r) =>
      !r.announced_meeting_id &&
      ((r.calling_status === "to_announce" && r.candidate_person_ids.length > 0) ||
        (r.release_status === "to_announce" && r.release_person_id))
  );

  const addEntry = async (formData: FormData) => {
    "use server";
    await createCallingPlanningEntry(formData);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Calling Planning" />

      <section className="mt-4">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">Calling Planning</h1>
        <p className="mt-2 text-sm text-slate">
          One row per potential calling change, across every calling &mdash; candidates, status,
          release, and readiness to announce in Sacrament Meeting. Candidates is a multi-select
          (Ctrl/Cmd-click to pick more than one) &mdash; narrow it down to exactly one person once
          decided, before announcing.
        </p>
        {filteredCallingName && (
          <p className="mt-2 text-xs text-slate">
            Filtered to <span className="text-ink">{filteredCallingName}</span> &mdash;{" "}
            <Link href="/calling-planning" className="hover:text-ink">
              show all callings
            </Link>
          </p>
        )}
        <p className="mt-2 text-xs text-slate">
          <Link href="/callings" className="hover:text-ink">
            Manage the calling roster (add a calling, set the current holder) &rarr;
          </Link>
        </p>
      </section>

      <div className="rounded-lg border border-rule bg-card p-6">
        <form action={addEntry} className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate">
            Calling
            <select
              name="calling_id"
              required
              defaultValue={callingFilter ?? ""}
              className="mt-1 block rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
            >
              <option value="" disabled>
                Choose a calling&hellip;
              </option>
              {callingOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate">
            Date Initiated
            <input
              type="date"
              name="date_initiated"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="mt-1 block rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-ink px-4 py-2 text-xs font-medium text-paper transition-colors hover:bg-ink/90"
          >
            + Start New Calling Change
          </button>
        </form>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate">No calling changes yet.</p>
        ) : (
          <CallingPlanningGridForm
            rows={rows}
            callingOptions={callingOptions}
            people={people}
            callingStatusOptions={callingStatusOptions}
            releaseStatusOptions={releaseStatusOptions}
          />
        )}
      </div>

      {readyToAnnounce.length > 0 && (
        <section className="rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Ready to Announce</h2>
          <p className="mt-1 text-xs text-slate">
            Calling Status or Release Status is &ldquo;To Announce in Sacrament&rdquo; &mdash; add
            each to an upcoming meeting&rsquo;s Ward Business.
          </p>
          <ul className="mt-4 flex flex-col gap-4">
            {readyToAnnounce.map((r) => {
              const needsNarrowing = r.calling_status === "to_announce" && r.candidate_person_ids.length > 1;
              return (
                <li key={r.id} className="rounded-md border border-rule/60 p-4">
                  <p className="text-sm text-ink">{r.calling_name}</p>
                  {needsNarrowing ? (
                    <p className="mt-2 text-xs text-brass">
                      Narrow Candidates down to exactly one person before this can be announced.
                    </p>
                  ) : (
                    <div className="mt-2">
                      <PushCallingForm
                        planningId={r.id}
                        callingId={r.calling_id}
                        upcomingSacramentMeetings={sacramentMeetings}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
