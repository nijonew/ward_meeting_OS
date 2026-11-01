import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { meetingFeature } from "@/lib/data/meeting-features";
import { getMeetingById } from "@/lib/data/meetings";
import {
  getMeetingWithType,
  getApplicableElements,
  getPlannedElements,
} from "@/lib/data/meeting-elements";
import { addTemplateElement } from "@/app/meetings/[id]/template-actions";
import { TemplateElementList } from "@/components/planning/TemplateElementList";

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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

  // Doesn't need anything from the authorization check below, so its
  // own fetch starts now rather than waiting for that check to pass
  // first (2026-10-31, chasing the user's own "this app is extremely
  // slow" report).
  const meetingWithTypePromise = getMeetingWithType(meetingId);

  const meetingStage = await getMeetingById(meetingId);
  if (!meetingStage) {
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }
  if (!hasFeature(profile, meetingFeature(meetingStage.meetingType, "template"))) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Agenda Elements" />
        <p className="mt-10 text-ink-muted">You don&rsquo;t have access to edit agenda elements for this meeting.</p>
      </main>
    );
  }

  const meeting = await meetingWithTypePromise;
  if (!meeting) {
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }
  // Archived meetings are read-only from here on -- editing the agenda
  // after the fact would contradict "the agenda as it was finalized"
  // (see app/meetings/[id]/archived).
  if (meetingStage.stage === "archived") {
    redirect(`/meetings/${meetingId}/archived`);
  }

  const [applicable, included] = await Promise.all([
    getApplicableElements(meeting.meetingTypeId),
    getPlannedElements(meetingId),
  ]);

  const includedElementIds = new Set(included.map((e) => e.element_id));
  // `announcements` is the one element that can be added to the same
  // meeting more than once -- a real second, independently-scoped
  // block (migration 074, 2026-10-11: "I just want the ability to add
  // a second announcement block before the closing hymn/prayer"), not
  // a config change to the existing one. Every other element still
  // follows the normal "add once" rule.
  const available = applicable.filter((e) => !includedElementIds.has(e.id) || e.key === "announcements");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Agenda Elements" />

      <div className="rounded border border-rule bg-surface p-6">
        <h2 className="font-display text-xl">
          {meeting.meetingTypeName} &middot; {formatDate(meeting.date)}
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Only affects this meeting. Add, remove, or reorder elements here without changing
          any other {meeting.meetingTypeName}. New meetings start from the default list managed at{" "}
          <Link href="/admin/meeting-templates" className="underline">
            Admin &rsaquo; Meeting Templates
          </Link>
          .
        </p>

        <div className="mt-4">
          <TemplateElementList meetingId={meetingId} included={included} />
        </div>
      </div>

      {available.length > 0 && (
        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Add Element</h2>
          <div className="mt-4 flex flex-col gap-2">
            {available.map((el) => {
              const add = async () => {
                "use server";
                await addTemplateElement(meetingId, el.id);
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
