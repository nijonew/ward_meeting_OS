import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getYouthActivities } from "@/lib/data/youth-activities";
import { YOUTH_ACTIVITY_GROUPS, YOUTH_DEVELOPMENT_CATEGORIES } from "@/lib/data/youth-activity-constants";
import {
  addYouthActivity,
  setYouthActivityStatus,
  deleteYouthActivity,
} from "@/app/youth-activities/actions";

const MANAGE_ROLES = [
  "bishopric",
  "yw_presidency",
  "yw_advisor",
  "yw_specialist",
  "ym_advisor",
  "ym_specialist",
];

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function YouthActivitiesPage() {
  // No login required to view -- RLS on youth_activities already limits
  // anonymous/other-role visitors to published rows only.
  const { profile } = await getSessionUser();
  const canManage = Boolean(profile?.role && MANAGE_ROLES.includes(profile.role));

  const activities = await getYouthActivities();

  const add = async (formData: FormData) => {
    "use server";
    await addYouthActivity(formData);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Youth Activities" />

      <div className="rounded-lg border border-rule bg-card p-6">
        <h2 className="font-display text-xl">Upcoming Activities</h2>

        {activities.length === 0 ? (
          <p className="mt-4 text-sm text-slate">Nothing scheduled yet.</p>
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
              const remove = async () => {
                "use server";
                await deleteYouthActivity(item.id);
              };
              return (
                <li key={item.id} className="rounded-md border border-rule/60 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-slate/70">
                        {formatDate(item.activity_date)}
                        {item.activity_time ? ` · ${item.activity_time}` : ""}
                      </span>{" "}
                      {item.title}
                    </span>
                    {canManage && (
                      <span className="flex items-center gap-2">
                        <span
                          className={[
                            "font-mono text-[10px] uppercase tracking-widest",
                            item.status === "published" ? "text-sage" : "text-brass",
                          ].join(" ")}
                        >
                          {item.status}
                        </span>
                        <form action={toggleStatus}>
                          <button type="submit" className="text-xs text-slate hover:text-ink">
                            {item.status === "published" ? "Unpublish" : "Publish"}
                          </button>
                        </form>
                        <form action={remove}>
                          <button type="submit" className="text-xs text-slate hover:text-ink">
                            Delete
                          </button>
                        </form>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-slate">
                    {item.group_name}
                    {item.development_category ? ` — ${item.development_category}` : ""}
                    {item.location ? ` — ${item.location}` : ""}
                  </p>
                  {(item.youth_lead || item.advisor_lead) && (
                    <p className="mt-1 text-[11px] text-slate/60">
                      {item.youth_lead ? `Youth lead: ${item.youth_lead}` : ""}
                      {item.youth_lead && item.advisor_lead ? " · " : ""}
                      {item.advisor_lead ? `Advisor: ${item.advisor_lead}` : ""}
                    </p>
                  )}
                  {item.notes && <p className="mt-1 text-slate">{item.notes}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canManage && (
        <div className="rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Add Activity</h2>
          <form action={add} className="mt-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate">
                Date
                <input
                  type="date"
                  name="activity_date"
                  required
                  className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="text-sm text-slate">
                Time
                <input
                  type="time"
                  name="activity_time"
                  className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
                />
              </label>
            </div>

            <label className="text-sm text-slate">
              Title
              <input
                type="text"
                name="title"
                required
                className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate">
                Group
                <select
                  name="group_name"
                  required
                  defaultValue=""
                  className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
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
              <label className="text-sm text-slate">
                Development Category
                <select
                  name="development_category"
                  defaultValue=""
                  className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
                >
                  <option value="">&mdash; None &mdash;</option>
                  {YOUTH_DEVELOPMENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="text-sm text-slate">
              Location
              <input
                type="text"
                name="location"
                className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate">
                Youth Lead
                <input
                  type="text"
                  name="youth_lead"
                  className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="text-sm text-slate">
                Advisor Lead
                <input
                  type="text"
                  name="advisor_lead"
                  className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
                />
              </label>
            </div>

            <label className="text-sm text-slate">
              Notes
              <textarea
                name="notes"
                rows={2}
                className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>

            <button
              type="submit"
              className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
            >
              Add &amp; Publish
            </button>
          </form>
        </div>
      )}
    </main>
  );
}