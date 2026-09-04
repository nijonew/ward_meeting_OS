import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getScheduleRules, type ScheduleRule } from "@/lib/data/meeting-schedule";
import { getMeetingTypes } from "@/lib/data/meetings";
import { addScheduleRule, deleteScheduleRule, toggleScheduleRuleActive } from "@/app/meeting-schedule/actions";
import { AddRuleForm } from "@/components/schedule/AddRuleForm";
import { GenerateMeetingsForm } from "@/components/schedule/GenerateMeetingsForm";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NTH_NAMES = ["1st", "2nd", "3rd", "4th", "5th"];

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function describeSchedule(r: ScheduleRule): string {
  if (r.cadence === "weekly") {
    return `Every ${DAY_NAMES[r.day_of_week ?? 0]}`;
  }
  if (r.cadence === "nth_weekday") {
    return `${NTH_NAMES[(r.nth_occurrence ?? 1) - 1]} ${DAY_NAMES[r.day_of_week ?? 0]} of the month`;
  }
  const offset = r.offset_days ?? 0;
  const anchor = `${NTH_NAMES[(r.anchor_nth_occurrence ?? 1) - 1]} ${DAY_NAMES[r.anchor_day_of_week ?? 0]}`;
  if (offset === 0) return anchor;
  return `${Math.abs(offset)} day${Math.abs(offset) === 1 ? "" : "s"} ${offset > 0 ? "after" : "before"} the ${anchor}`;
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
          <table className="mt-4 w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-mono text-[10px] uppercase tracking-widest text-slate/70">
                <th className="pb-2 pr-3">Meeting Type</th>
                <th className="pb-2 pr-3">Schedule</th>
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
                    <td className="py-2 pr-3 text-slate">{describeSchedule(r)}</td>
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

        <AddRuleForm meetingTypes={meetingTypes} onAdd={addRule} />
        <p className="mt-2 text-[11px] text-slate/60">
          For &ldquo;1st and 3rd Tuesday,&rdquo; add two Nth-of-month rules. For something like
          &ldquo;the Tuesday after the 3rd Sunday,&rdquo; use Relative &mdash; it&rsquo;s computed
          from the anchor day each month rather than a fixed numbered weekday, so it lands correctly
          no matter how the month falls.
        </p>
      </div>

      <GenerateMeetingsForm />
    </main>
  );
}