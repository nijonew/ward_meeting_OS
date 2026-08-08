import { redirect } from "next/navigation";
import { getMeetingById } from "@/lib/data/meetings";
import { getTemplateBySlug } from "@/lib/data/templates";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { saveTemplate } from "@/app/meetings/[id]/template-actions";

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;

  const { user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const meeting = await getMeetingById(meetingId);
  if (!meeting) {
    return <p className="text-slate">Could not load this meeting.</p>;
  }

  const templateText = await getTemplateBySlug(meeting.meetingType);
  const save = saveTemplate.bind(null, meeting.meetingType, meetingId);

  return (
    <div className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">{meeting.title} Template</h2>
      <p className="mt-1 text-xs text-slate">
        Shared across every {meeting.title}, not just this one &mdash; edit it once here and it
        applies going forward.
      </p>

      <form action={save} className="mt-4">
        <textarea
          name="template_text"
          defaultValue={templateText ?? ""}
          rows={12}
          className="block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          className="mt-3 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
        >
          Save
        </button>
      </form>
    </div>
  );
}