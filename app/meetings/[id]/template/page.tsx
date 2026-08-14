import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import {
  getMeetingWithType,
  getApplicableElements,
  getTemplateElements,
} from "@/lib/data/meeting-elements";
import {
  addTemplateElement,
  removeTemplateElement,
  setTemplateSlotCount,
  moveTemplateElement,
} from "@/app/meetings/[id]/template-actions";

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;

  const { user, profile } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Template" />
        <p className="mt-10 text-slate">Only the Bishopric can edit templates.</p>
      </main>
    );
  }

  const meeting = await getMeetingWithType(meetingId);
  if (!meeting) {
    return <p className="text-slate">Could not load this meeting.</p>;
  }

  const [applicable, included] = await Promise.all([
    getApplicableElements(meeting.meetingTypeId),
    getTemplateElements(meeting.meetingTypeId),
  ]);

  const includedElementIds = new Set(included.map((e) => e.element_id));
  const available = applicable.filter((e) => !includedElementIds.has(e.id));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Template" />

      <div className="rounded-lg border border-rule bg-card p-6">
        <h2 className="font-display text-xl">{meeting.meetingTypeName} Template</h2>
        <p className="mt-1 text-xs text-slate">
          Shared across every {meeting.meetingTypeName}, not just this one &mdash; changes here
          apply going forward.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {included.length === 0 ? (
            <p className="text-sm text-slate">No elements added yet.</p>
          ) : (
            included.map((el, idx) => {
              const moveUp = async () => {
                "use server";
                await moveTemplateElement(meetingId, meeting.meetingTypeId, el.id, "up");
              };
              const moveDown = async () => {
                "use server";
                await moveTemplateElement(meetingId, meeting.meetingTypeId, el.id, "down");
              };
              const remove = async () => {
                "use server";
                await removeTemplateElement(meetingId, el.id);
              };
              const setSlots = async (formData: FormData) => {
                "use server";
                const value = Number(formData.get("slot_count"));
                await setTemplateSlotCount(meetingId, el.id, value);
              };

              return (
                <div
                  key={el.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rule/60 px-3 py-2 text-sm"
                >
                  <span className="text-ink">{el.label}</span>

                  <span className="flex items-center gap-2">
                    {el.repeatable && (
                      <form action={setSlots} className="flex items-center gap-1">
                        <input
                          type="number"
                          name="slot_count"
                          min={1}
                          max={el.max_slots ?? undefined}
                          defaultValue={el.slot_count ?? 1}
                          className="w-14 rounded-md border border-rule bg-paper px-2 py-1 text-xs text-ink"
                        />
                        <button type="submit" className="text-xs text-slate hover:text-ink">
                          Set
                        </button>
                      </form>
                    )}
                    <form action={moveUp}>
                      <button
                        type="submit"
                        disabled={idx === 0}
                        className="text-xs text-slate hover:text-ink disabled:opacity-30"
                      >
                        &uarr;
                      </button>
                    </form>
                    <form action={moveDown}>
                      <button
                        type="submit"
                        disabled={idx === included.length - 1}
                        className="text-xs text-slate hover:text-ink disabled:opacity-30"
                      >
                        &darr;
                      </button>
                    </form>
                    <form action={remove}>
                      <button type="submit" className="text-xs text-slate hover:text-ink">
                        Remove
                      </button>
                    </form>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {available.length > 0 && (
        <div className="rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Add Element</h2>
          <div className="mt-4 flex flex-col gap-2">
            {available.map((el) => {
              const add = async () => {
                "use server";
                await addTemplateElement(meetingId, meeting.meetingTypeId, el.id);
              };
              return (
                <div
                  key={el.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-rule/60 px-3 py-2 text-sm"
                >
                  <span className="text-ink">{el.label}</span>
                  <form action={add}>
                    <button type="submit" className="text-xs text-slate hover:text-ink">
                      Add
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}