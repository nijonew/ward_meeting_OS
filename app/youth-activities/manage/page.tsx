import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getYouthActivityScheduleRules } from "@/lib/data/youth-activity-cadence-rules";
import { YOUTH_ACTIVITY_GROUPS, YOUTH_DEVELOPMENT_CATEGORIES } from "@/lib/data/youth-activity-constants";
import { addYouthActivity } from "@/app/youth-activities/actions";
import {
  addScheduleRule,
  updateScheduleRule,
  deleteScheduleRule,
  toggleScheduleRuleActive,
  generateActivities,
} from "@/app/youth-activities/schedule-actions";
import { YouthActivityScheduleManager } from "@/components/schedule/YouthActivityScheduleManager";
import { GenerateForm } from "@/components/schedule/GenerateForm";
import { GenerateYouthActivitiesForm } from "@/components/youth-activities/GenerateYouthActivitiesForm";

/**
 * Split out of /youth-activities itself (2026-10-11, the user's own
 * request): "remove 'All Activities' table and add activity and
 * cadence and generate activities. Those last three should be seen
 * only when clicking on the manage tile which should only be visible
 * to those with access." Everything here is exactly what used to sit
 * inline, canManage-gated, on the main page -- Add Activity, both
 * Generate actions (the fixed combined-week rotation and the general
 * cadence-rule engine), and the cadence-rule manager itself -- just
 * reached through its own tile now instead of always rendering below
 * the read-only browsing tiles.
 */
export default async function YouthActivitiesManagePage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!hasFeature(profile, "youth_activity_planning")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Manage Youth Activities" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to manage youth activities.</p>
      </main>
    );
  }

  const scheduleRules = await getYouthActivityScheduleRules();

  const add = async (formData: FormData) => {
    "use server";
    await addYouthActivity(formData);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Manage Youth Activities" />

      <div>
        <Link href="/youth-activities" className="text-xs text-ink-muted hover:text-ink">
          &larr; Youth Activities
        </Link>
      </div>

      <TileGrid>
        <Tile
          title="Class Activities"
          description="Each class's own weekly schedule, drawn from Combined where it applies"
          href="/youth-activities/manage/classes"
        />
      </TileGrid>

      <GenerateYouthActivitiesForm />

      <div className="rounded border border-rule bg-surface p-6">
        <h2 className="font-display text-xl">Add Activity</h2>
        <form action={add} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink-muted">
              Date
              <input
                type="date"
                name="activity_date"
                required
                className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="text-sm text-ink-muted">
              Time
              <input
                type="time"
                name="activity_time"
                className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>
          </div>

          <label className="text-sm text-ink-muted">
            Title
            <input
              type="text"
              name="title"
              required
              className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink-muted">
              Group
              <select
                name="group_name"
                required
                defaultValue=""
                className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
              >
                <option value="" disabled>
                  Choose group
                </option>
                {YOUTH_ACTIVITY_GROUPS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-ink-muted">
              Development Category
              <select
                name="development_category"
                defaultValue=""
                className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
              >
                <option value="">None</option>
                {YOUTH_DEVELOPMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-sm text-ink-muted">
            Location
            <input
              type="text"
              name="location"
              className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink-muted">
              Youth Lead
              <input
                type="text"
                name="youth_lead"
                className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="text-sm text-ink-muted">
              Advisor Lead
              <input
                type="text"
                name="advisor_lead"
                className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>
          </div>

          <label className="text-sm text-ink-muted">
            Notes
            <textarea
              name="notes"
              rows={2}
              className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>

          <button
            type="submit"
            className="w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep"
          >
            Add &amp; Publish
          </button>
        </form>
      </div>

      <YouthActivityScheduleManager
        rules={scheduleRules}
        onAdd={addScheduleRule}
        onUpdate={updateScheduleRule}
        onDelete={deleteScheduleRule}
        onToggle={toggleScheduleRuleActive}
      />
      <p className="-mt-3 text-[11px] text-ink-muted/60">
        For a recurring activity like a weekly Wednesday night, add one rule here instead of
        entering it week by week. Use Edit to change a rule in place, or Copy to start a new
        one from its values.
      </p>
      <GenerateForm
        action={generateActivities}
        heading="Generate Activities"
        itemLabelSingular="activity"
        itemLabelPlural="activities"
      />
    </main>
  );
}
