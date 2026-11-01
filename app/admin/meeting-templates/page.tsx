import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getMeetingTypes } from "@/lib/data/meeting-types";
import { getApplicableElements, getTemplateElements } from "@/lib/data/meeting-elements";
import { SPECIAL_FORMATS } from "@/lib/data/sacrament-constants";
import { addDefaultTemplateElement } from "./actions";
import { DefaultTemplateElementList } from "@/components/admin/DefaultTemplateElementList";

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={[
        "rounded px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors",
        active ? "bg-ink text-paper" : "text-ink-muted hover:text-ink",
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

  if (!hasFeature(profile, "meeting_templates_admin")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Meeting Templates" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to edit meeting templates.</p>
      </main>
    );
  }

  const meetingTypes = await getMeetingTypes();
  if (meetingTypes.length === 0) {
    return <p className="text-ink-muted">No meeting types configured.</p>;
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
        <Link href="/admin" className="text-xs text-ink-muted hover:text-ink">
          &larr; All tables
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Meeting Templates</h1>
      </section>

      <div className="flex w-fit flex-wrap gap-1 rounded border border-rule p-1">
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
        <div className="flex w-fit flex-wrap gap-1 rounded border border-rule p-1">
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

      <div className="rounded border border-rule bg-surface p-6">
        <h2 className="font-display text-xl">
          {selectedType.name}
          {isSacrament && ` · ${SPECIAL_FORMATS.find((f) => f.value === formatKey)?.label}`}
        </h2>

        <div className="mt-4">
          <DefaultTemplateElementList meetingTypeId={selectedType.id} formatKey={formatKey} included={included} />
        </div>
      </div>

      {available.length > 0 && (
        <div className="rounded border border-rule bg-surface p-6">
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
                  className="flex items-center justify-between gap-2 rounded border border-rule/60 px-3 py-2 text-sm"
                >
                  <span className="text-ink">{el.label}</span>
                  <form action={add}>
                    <button type="submit" className="text-xs text-ink-muted hover:text-ink">
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
