import { redirect } from "next/navigation";
import { getConductingRows } from "@/lib/data/conducting";
import { getMeetingById } from "@/lib/data/meetings";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { ConductingScriptView } from "@/components/planning/ConductingScriptView";

/**
 * Rebuilt 2026-09-10 around `getConductingRows` (lib/data/conducting.ts)
 * -- template-driven the same way Planning is, instead of a hand-written
 * fixed sequence. This page itself is now a thin wrapper: the initial
 * render + the Bishopric-only gate happen here (Server Component,
 * unchanged from the fix added earlier the same day); the actual
 * row list + the "updates without a manual refresh" polling live in
 * ConductingScriptView (Client Component).
 */
export default async function ConductingViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;

  const { user, profile } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  // Had no role check at all before 2026-09-10 -- any logged-in account
  // could read any meeting's full conducting script, the same gap
  // already found and fixed for Planning/Live on 2026-09-08. Conducting
  // only exists for Sacrament Meeting, hence its own dedicated feature
  // (2026-10-04) rather than a per-type lookup; a non-admin wanting
  // this meeting's program wants the actual public page instead.
  if (!hasFeature(profile, "sacrament_conducting")) {
    redirect(`/meetings/${meetingId}/public`);
  }

  // Cancelled Sacrament Meetings don't show Planning/Conducting/Public
  // at all (2026-10-04, the user's own request) -- see
  // app/meetings/[id]/planning/page.tsx's own comment on this; a
  // non-admin never reaches this page at all (redirected to /public
  // above), which independently shows the same notice.
  const meeting = await getMeetingById(meetingId);
  if (meeting?.cancelled) {
    return (
      <p className="text-ink-muted">
        This meeting has been cancelled{meeting.cancellationNote ? `: ${meeting.cancellationNote}` : "."}
      </p>
    );
  }

  const script = await getConductingRows(meetingId);

  if (!script) {
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {script.specialFormat !== "standard" && (
        <div className="rounded border border-accent/40 bg-surface px-4 py-3 text-sm text-ink">
          This meeting is flagged as <strong>{script.specialFormat.replace(/_/g, " ")}</strong>.
          The standard script below may not fit. Read through it before the meeting and adjust as
          needed.
        </div>
      )}
      <ConductingScriptView meetingId={meetingId} initialRows={script.rows} />
    </div>
  );
}
