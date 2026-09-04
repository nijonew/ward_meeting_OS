import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getScheduleRules } from "@/lib/data/meeting-schedule";
import { getMeetingTypes } from "@/lib/data/meetings";
import { addScheduleRule, deleteScheduleRule, toggleScheduleRuleActive } from "@/app/meeting-schedule/actions";
import { GenerateMeetingsForm } from "@/components/schedule/GenerateMeetingsForm";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NTH_NAMES = ["1st", "2nd", "3rd", "4th", "5th"];

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export default async function MeetingSchedulePage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Meeting Schedule" />
        <p className="mt-10 text-slate">Only the Bishopric can manage the meeting schedule.</p>
      </main>
    );
  }

  const [rules, meetingTypes] = await Promise.all([getScheduleRules(), getMeetingTypes()]);

  const addRule = async (formData: FormData) => {
    "use server";
    await addScheduleRule(formData);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Meeting Schedule" />

      <section className="mt-4">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">Meeting Schedule</h1>
        <p className="mt-2 text-sm text-slate">
          Set the typical cadence for each meeting type, then generate real meetings from it.
        </p>
      </section>

      <div className="overflow-x-auto rounded-lg border border-rule bg-card p-6">
        <h2 className="font-display text-xl">Cadence</h2>

        {rules.length > 0 && (
          <table className="mt-4 w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-mono text-[10px] uppercase tracking-widest text-slate/70">
                <th className="pb-2 pr-3">Meeting Type</th>
                <th className="pb-2 pr-3">Cadence</th>
                <th className="pb-2 pr-3">Day</th>
                <th className="pb-2 pr-3">Time</th>
                <th className="pb-2 pr-3">Duration</th>
                <th className="pb-2 pr-3">Active</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const toggle = async () => {
                  "use server";
                  await toggleScheduleRuleActive(r.id, r.active);
                };
                const remove = async () => {
                  "use server";
                  await deleteScheduleRule(r.id);
                };
                return (
                  <tr key={r.id} className="border-b border-rule/40 last:border-0">
                    <td className="py-2 pr-3 text-ink">{r.meeting_type_name}</td>
                    <td className="py-2 pr-3 text-slate">
                      {r.cadence === "weekly" ? "Weekly" : `${NTH_NAMES[(r.nth_occurrence ?? 1) - 1]} of month`}
                    </td>
                    <td className="py-2 pr-3 text-slate">{DAY_NAMES[r.day_of_week]}</td>
                    <td className="py-2 pr-3 text-slate">{formatTime(r.time_of_day)}</td>
                    <td className="py-2 pr-3 text-slate">{r.duration_minutes} min</td>
                    <td className="py-2 pr-3">
                      <form action={toggle}>
                        <button
                          type="submit"
                          className={[
                            "font-mono text-[10px] uppercase tracking-widest",
                            r.active ? "text-sage" : "text-slate/50",
                          ].join(" ")}
                        >
                          {r.active ? "Active" : "Paused"}
                        </button>
                      </form>
                    </td>
                    <td className="py-2">
                      <form action={remove}>
                        <button type="submit" className="text-xs text-slate hover:text-ink">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <form action={addRule} className="mt-6 grid grid-cols-2 gap-3 border-t border-rule/60 pt-6 sm:grid-cols-6">
          <select
            name="meeting_type_id"
            required
            defaultValue=""
            className="col-span-2 rounded-md border border-rule bg-paper px-2 py-2 text-xs text-ink sm:col-span-1"
          >
            <option value="" disabled>
              Meeting type
            </option>
            {meetingTypes.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            name="cadence"
            required
            defaultValue="weekly"
            className="rounded-md border border-rule bg-paper px-2 py-2 text-xs text-ink"
          >
            <option value="weekly">Weekly</option>
            <option value="nth_weekday">Nth of month</option>
          </select>

          <select
            name="nth_occurrence"
            defaultValue=""
            className="rounded-md border border-rule bg-paper px-2 py-2 text-xs text-ink"
          >
            <option value="">&mdash;</option>
            {NTH_NAMES.map((n, i) => (
              <option key={n} value={i + 1}>
                {n}
              </option>
            ))}
          </select>

          <select
            name="day_of_week"
            required
            defaultValue=""
            className="rounded-md border border-rule bg-paper px-2 py-2 text-xs text-ink"
          >
            <option value="" disabled>
              Day
            </option>
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>

          <input
            type="time"
            name="time_of_day"
            required
            className="rounded-md border border-rule bg-paper px-2 py-2 text-xs text-ink"
          />

          <input
            type="number"
            name="duration_minutes"
            required
            min={5}
            step={5}
            placeholder="Minutes"
            className="rounded-md border border-rule bg-paper px-2 py-2 text-xs text-ink"
          />

          <button
            type="submit"
            className="col-span-2 w-fit rounded-md bg-ink px-4 py-2 text-xs font-medium text-paper transition-colors hover:bg-ink/90 sm:col-span-6"
          >
            Add Rule
          </button>
        </form>
        <p className="mt-2 text-[11px] text-slate/60">
          For a cadence like &ldquo;1st and 3rd Tuesday,&rdquo; add two rules with the same meeting
          type &mdash; one for each week.
        </p>
      </div>

      <GenerateMeetingsForm />
    </main>
  );
}