import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getYouthActivities } from "@/lib/data/youth-activities";
import { getYouthActivityScheduleRules } from "@/lib/data/youth-activity-cadence-rules";
import { YOUTH_ACTIVITY_GROUPS, YOUTH_DEVELOPMENT_CATEGORIES } from "@/lib/data/youth-activity-constants";
import {
  addYouthActivity,
  setYouthActivityStatus,
  deleteYouthActivity,
  toggleYouthActivityConfirmed,
  setYouthActivityCancellation,
  uncancelYouthActivity,
} from "@/app/youth-activities/actions";
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

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function YouthActivitiesPage() {
  // Now requires login (2026-10-07, the user's own request -- the
  // landing page's own tile shows "Please log in to see youth
  // activities" when logged out, and must actually mean it). Used to
  // be open with no login at all, relying on RLS to limit anonymous
  // visitors to published rows -- that RLS policy is unaffected and
  // still correct for a logged-in-but-otherwise-unprivileged viewer,
  // this just adds the login requirement on top of it.
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");
  const canManage = hasFeature(profile, "youth_activity_planning");

  const activities = await getYouthActivities();
  const scheduleRules = canManage ? await getYouthActivityScheduleRules() : [];

  const add = async (formData: FormData) => {
    "use server";
    await addYouthActivity(formData);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Youth Activities" />

      <div>
        <Link href="/youth-activity-planning" className="text-xs text-ink-muted hover:text-ink">
          &larr; Youth Activity Planning
        </Link>
      </div>

      {/* Added 2026-10-10 (the user's own report, right after this page
          got a new sibling entry point from the Youth Activity Planning
          hub: "the youth activities page right now shows no tiles and
          just has all of the content on the page. Please update with
          the suggested tiles which will then direct the user to the
          requested page.") -- these four were the activity-specific
          tiles from that earlier spec; the two teaching tiles stayed on
          the top-level hub since they're a different domain. Each links
          to a read-only, filtered ActivitiesTable view (see that
          component's own comment) -- open to anyone who can reach this
          page at all, not feature-gated, matching this page's own
          existing "any logged-in account can view" policy; only the
          All Activities section and its edit controls below stay
          canManage-gated. */}
      <TileGrid>
        <Tile title="Upcoming Activities" description="Every activity, all groups" href="/youth-activities/upcoming" />
        <Tile
          title="Combined Young Men & Young Women Activities"
          description="Combined YM/YW schedule"
          href="/youth-activities/combined-ym-yw"
        />
        <Tile title="Combined Young Men Activities" description="Combined YM schedule" href="/youth-activities/combined-ym" />
        <Tile
          title="Combined Young Women Activities"
          description="Combined YW schedule"
          href="/youth-activities/combined-yw"
        />
      </TileGrid>

      <div className="rounded border border-rule bg-surface p-6">
        {/* Renamed from "Upcoming Activities" (2026-10-10) -- that name
            now belongs to the new read-only tile/page above instead.
            This section shows every activity regardless of date, plus
            (for canManage) the actual edit controls, so "All Activities"
            describes it more accurately than "Upcoming" ever did. */}
        <h2 className="font-display text-xl">All Activities</h2>

        {activities.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">Nothing scheduled yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {activities.map((item) => {
              const toggleStatus = async () => {
                "use server";
                await setYouthActivityStatus(
                  item.id,
                  item.status === "published" ? "draft" : "published"
                );
              };
              const toggleConfirmed = async () => {
                "use server";
                await toggleYouthActivityConfirmed(item.id, !item.confirmed);
              };
              const uncancel = async () => {
                "use server";
                await uncancelYouthActivity(item.id);
              };
              const remove = async () => {
                "use server";
                await deleteYouthActivity(item.id);
              };
              return (
                <li
                  key={item.id}
                  className={[
                    "rounded border px-3 py-2 text-sm",
                    item.cancelled ? "border-danger/30 bg-danger/5" : "border-rule/60",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                        {formatDate(item.activity_date)}
                        {item.activity_time ? ` · ${item.activity_time}` : ""}
                      </span>{" "}
                      {item.title}
                      {item.cancelled && (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-danger">
                          Cancelled
                        </span>
                      )}
                      {!item.confirmed && !item.cancelled && (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-accent">
                          Tentative
                        </span>
                      )}
                    </span>
                    {canManage && (
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            "font-mono text-[10px] uppercase tracking-wider",
                            item.status === "published" ? "text-success" : "text-accent",
                          ].join(" ")}
                        >
                          {item.status}
                        </span>
                        <form action={toggleStatus}>
                          <button type="submit" className="text-xs text-ink-muted hover:text-ink">
                            {item.status === "published" ? "Unpublish" : "Publish"}
                          </button>
                        </form>
                        <form action={toggleConfirmed}>
                          <button type="submit" className="text-xs text-ink-muted hover:text-ink">
                            {item.confirmed ? "Mark Tentative" : "Confirm"}
                          </button>
                        </form>
                        {item.cancelled ? (
                          <form action={uncancel}>
                            <button type="submit" className="text-xs text-ink-muted hover:text-ink">
                              Un-cancel
                            </button>
                          </form>
                        ) : (
                          <form
                            action={async (formData: FormData) => {
                              "use server";
                              await setYouthActivityCancellation(formData);
                            }}
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="id" value={item.id} />
                            <input
                              type="text"
                              name="cancellation_note"
                              placeholder="Reason (optional)"
                              className="w-32 rounded border border-rule bg-paper px-1.5 py-1 text-[11px] text-ink"
                            />
                            <button type="submit" className="text-xs text-danger/70 hover:text-danger">
                              Cancel
                            </button>
                          </form>
                        )}
                        <form action={remove}>
                          <button type="submit" className="text-xs text-danger/70 hover:text-danger">
                            Delete
                          </button>
                        </form>
                      </span>
                    )}
                  </div>
                  {item.cancelled ? (
                    <p className="mt-1 text-danger">
                      This activity has been cancelled{item.cancellation_note ? `: ${item.cancellation_note}` : "."}
                    </p>
                  ) : (
                    <p className="mt-1 text-ink-muted">
                      {item.group_name}
                      {item.planning_group ? ` · planned by ${item.planning_group}` : ""}
                      {item.development_category ? ` · ${item.development_category}` : ""}
                      {item.location ? ` · ${item.location}` : ""}
                    </p>
                  )}
                  {(item.youth_lead || item.advisor_lead) && (
                    <p className="mt-1 text-[11px] text-ink-muted/60">
                      {item.youth_lead ? `Youth lead: ${item.youth_lead}` : ""}
                      {item.youth_lead && item.advisor_lead ? " · " : ""}
                      {item.advisor_lead ? `Advisor: ${item.advisor_lead}` : ""}
                    </p>
                  )}
                  {item.notes && <p className="mt-1 text-ink-muted">{item.notes}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canManage && <GenerateYouthActivitiesForm />}

      {canManage && (
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
      )}

      {canManage && (
        <>
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
        </>
      )}
    </main>
  );
}