import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getWardEvents } from "@/lib/data/ward-events";
import { getWardEventScheduleRules } from "@/lib/data/ward-event-schedule";
import { addWardEvent, setWardEventStatus, deleteWardEvent } from "@/app/ward-events/actions";
import {
  addScheduleRule,
  updateScheduleRule,
  deleteScheduleRule,
  toggleScheduleRuleActive,
  generateEvents,
} from "@/app/ward-events/schedule-actions";
import { WardEventScheduleManager } from "@/components/schedule/WardEventScheduleManager";
import { GenerateForm } from "@/components/schedule/GenerateForm";

const MANAGE_ROLES = ["bishopric", "communications_specialist"];

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function WardEventsPage() {
  // No login required to view -- RLS on ward_events already limits
  // anonymous/other-role visitors to published rows only.
  const { profile } = await getSessionUser();
  const canManage = Boolean(profile?.role && MANAGE_ROLES.includes(profile.role));

  const events = await getWardEvents();
  const scheduleRules = canManage ? await getWardEventScheduleRules() : [];

  const add = async (formData: FormData) => {
    "use server";
    await addWardEvent(formData);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Ward Events" />

      <div className="rounded-lg border border-rule bg-card p-6">
        <h2 className="font-display text-xl">Upcoming Events</h2>

        {events.length === 0 ? (
          <p className="mt-4 text-sm text-slate">Nothing scheduled yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {events.map((item) => {
              const toggleStatus = async () => {
                "use server";
                await setWardEventStatus(item.id, item.status === "published" ? "draft" : "published");
              };
              const remove = async () => {
                "use server";
                await deleteWardEvent(item.id);
              };
              return (
                <li key={item.id} className="rounded-md border border-rule/60 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-slate/70">
                        {formatDate(item.event_date)}
                        {item.event_time ? ` \u00b7 ${item.event_time}` : ""}
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
                  {item.location && <p className="mt-1 text-slate">{item.location}</p>}
                  {item.notes && <p className="mt-1 text-slate">{item.notes}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canManage && (
        <div className="rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Add Event</h2>
          <form action={add} className="mt-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate">
                Date
                <input
                  type="date"
                  name="event_date"
                  required
                  className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="text-sm text-slate">
                Time
                <input
                  type="time"
                  name="event_time"
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

            <label className="text-sm text-slate">
              Location
              <input
                type="text"
                name="location"
                className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
              />
            </label>

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

      {canManage && (
        <>
          <WardEventScheduleManager
            rules={scheduleRules}
            onAdd={addScheduleRule}
            onUpdate={updateScheduleRule}
            onDelete={deleteScheduleRule}
            onToggle={toggleScheduleRuleActive}
          />
          <p className="-mt-3 text-[11px] text-slate/60">
            For a recurring event like a monthly Ward Temple Night, add one rule here instead of
            entering it month by month. Use Edit to change a rule in place, or Copy to start a new
            one from its values.
          </p>
          <GenerateForm
            action={generateEvents}
            heading="Generate Events"
            itemLabelSingular="event"
            itemLabelPlural="events"
          />
        </>
      )}
    </main>
  );
}