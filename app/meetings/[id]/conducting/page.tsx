import { redirect } from "next/navigation";
import { getConductingRows } from "@/lib/data/conducting";
import { getSessionUser } from "@/lib/supabase/get-session-user";
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
  // already found and fixed for Planning/Live on 2026-09-08. Whoever
  // conducts is Bishopric; a non-admin wanting this meeting's program
  // wants the actual public page instead.
  if (profile?.role !== "bishopric") {
    redirect(`/meetings/${meetingId}/public`);
  }

  const script = await getConductingRows(meetingId);

  if (!script) {
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {script.specialFormat !== "standard" && (
        <div className="rounded-md border border-accent/40 bg-surface px-4 py-3 text-sm text-ink">
          This meeting is flagged as <strong>{script.specialFormat.replace(/_/g, " ")}</strong> —
          the standard script below may not fit. Read through it before the meeting and adjust as
          needed.
        </div>
      )}
      <ConductingScriptView meetingId={meetingId} initialRows={script.rows} />
    </div>
  );
}
