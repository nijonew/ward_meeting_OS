import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getScheduleRules } from "@/lib/data/meeting-schedule";
import { getMeetingTypes } from "@/lib/data/meetings";
import { addScheduleRule, updateScheduleRule, deleteScheduleRule, toggleScheduleRuleActive } from "@/app/meeting-schedule/actions";
import { RulesManager } from "@/components/schedule/RulesManager";
import { GenerateMeetingsForm } from "@/components/schedule/GenerateMeetingsForm";

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

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Meeting Schedule" />

      <section className="mt-4">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">Meeting Schedule</h1>
        <p className="mt-2 text-sm text-slate">
          Set the typical cadence for each meeting type, then generate real meetings from it.
        </p>
      </section>

      <RulesManager
        rules={rules}
        meetingTypes={meetingTypes}
        onAdd={addScheduleRule}
        onUpdate={updateScheduleRule}
        onDelete={deleteScheduleRule}
        onToggle={toggleScheduleRuleActive}
      />
      <p className="-mt-3 text-[11px] text-slate/60">
        For &ldquo;1st and 3rd Tuesday,&rdquo; add two Nth-of-month rules. For something like &ldquo;the
        Tuesday after the 3rd Sunday,&rdquo; use Relative &mdash; it&rsquo;s computed from the anchor
        day each month rather than a fixed numbered weekday, so it lands correctly no matter how the
        month falls. Use Edit to change a rule in place, or Copy to start a new one from its values.
      </p>

      <GenerateMeetingsForm />
    </main>
  );
}
