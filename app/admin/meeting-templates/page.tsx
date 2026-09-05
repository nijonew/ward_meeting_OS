import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getMeetingTypes } from "@/lib/data/meeting-types";
import { getApplicableElements, getTemplateElements } from "@/lib/data/meeting-elements";
import { SPECIAL_FORMATS } from "@/lib/data/sacrament-constants";
import {
  addDefaultTemplateElement,
  removeDefaultTemplateElement,
  setDefaultTemplateSlotCount,
  moveDefaultTemplateElement,
} from "./actions";

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={[
        "rounded-md px-3 py-1.5 text-xs font-mono uppercase tracking-widest transition-colors",
        active ? "bg-ink text-paper" : "text-slate hover:text-ink",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default async function MeetingTemplatesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; format?: string }>;
}) {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Meeting Templates" />
        <p className="mt-10 text-slate">Only the Bishopric can edit meeting templates.</p>
      </main>
    );
  }

  const meetingTypes = await getMeetingTypes();
  if (meetingTypes.length === 0) {
    return <p className="text-slate">No meeting types configured.</p>;
  }

  const { type: rawType, format: rawFormat } = await searchParams;
  const selectedType =
    meetingTypes.find((mt) => mt.slug === rawType) ??
    meetingTypes.find((mt) => mt.slug === "sacrament-meeting") ??
    meetingTypes[0];
  const isSacrament = selectedType.slug === "sacrament-meeting";
  const formatKey = isSacrament
    ? SPECIAL_FORMATS.some((f) => f.value === rawFormat)
      ? (rawFormat as string)
      : "standard"
    : null;

  const [applicable, included] = await Promise.all([
    getApplicableElements(selectedType.id),
    getTemplateElements(selectedType.id, formatKey),
  ]);

  const includedElementIds = new Set(included.map((e) => e.element_id));
  const available = applicable.filter((e) => !includedElementIds.has(e.id));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Meeting Templates" />

      <section className="mt-4">
        <Link href="/admin" className="text-xs text-slate hover:text-ink">
          &larr; All tables
        </Link>
        <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">Meeting Templates</h1>
        <p className="mt-2 text-sm text-slate">
          The default agenda new meetings are seeded with at creation time. Editing here never
          changes a meeting that already exists &mdash; edit one specific meeting&rsquo;s own agenda
          from its <em>Agenda Elements</em> page instead (linked from its Planning view).
        </p>
      </section>

      <div className="flex w-fit flex-wrap gap-1 rounded-md border border-rule p-1">
        {meetingTypes.map((mt) => (
          <TabLink
            key={mt.id}
            href={`/admin/meeting-templates?type=${mt.slug}`}
            active={mt.id === selectedType.id}
            label={mt.name}
          />
        ))}
      </div>

      {isSacrament && (
        <div className="flex w-fit flex-wrap gap-1 rounded-md border border-rule p-1">
          {SPECIAL_FORMATS.map((f) => (
            <TabLink
              key={f.value}
              href={`/admin/meeting-templates?type=sacrament-meeting&format=${f.value}`}
              active={f.value === formatKey}
              label={f.label}
            />
          ))}
        </div>
      )}

      <div className="rounded-lg border border-rule bg-card p-6">
        <h2 className="font-display text-xl">
          {selectedType.name}
          {isSacrament && ` — ${SPECIAL_FORMATS.find((f) => f.value === formatKey)?.label}`}
        </h2>

        <div className="mt-4 flex flex-col gap-2">
          {included.length === 0 ? (
            <p className="text-sm text-slate">No elements added yet.</p>
          ) : (
            included.map((el, idx) => {
              const moveUp = async () => {
                "use server";
                await moveDefaultTemplateElement(selectedType.id, formatKey, el.id, "up");
              };
              const moveDown = async () => {
                "use server";
                await moveDefaultTemplateElement(selectedType.id, formatKey, el.id, "down");
              };
              const remove = async () => {
                "use server";
                await removeDefaultTemplateElement(el.id);
              };
              const setSlots = async (formData: FormData) => {
                "use server";
                const value = Number(formData.get("slot_count"));
                await setDefaultTemplateSlotCount(el.id, value);
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
                await addDefaultTemplateElement(selectedType.id, formatKey, el.id);
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
