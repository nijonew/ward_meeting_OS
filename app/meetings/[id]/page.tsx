import { redirect } from "next/navigation";
import { getMeetingById } from "@/lib/data/meetings";

/**
 * The bare /meetings/[id] route itself has no content of its own --
 * defaults straight to Planning (2026-10-03, the user's own request:
 * "when entering a meeting instance from a dashboard please default to
 * the planning view"), rather than a "choose a view above" stub. Every
 * meeting type has a Planning tab (Sacrament Meeting's own
 * Planning/Conducting/Public set, and the collaborative types'
 * Template/Planning/Live set both include it), and Planning's own
 * existing gate already handles everything that needs to happen from
 * here on -- redirecting a non-admin to the read-only view, an archived
 * meeting to its own view -- so there's nothing to duplicate by
 * redirecting unconditionally rather than re-deciding where to send
 * someone here.
 */
export default async function MeetingOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;
  const meeting = await getMeetingById(meetingId);

  if (!meeting) {
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }

  redirect(`/meetings/${meetingId}/planning`);
}
