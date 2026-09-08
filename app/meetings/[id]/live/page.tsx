import { redirect } from "next/navigation";
import { getMeetingById } from "@/lib/data/meetings";
import { getBishopricMeetingData } from "@/lib/data/bishopric-meeting";
import { getCouncilNotes } from "@/lib/data/council-notes";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { BishopricLiveView } from "@/components/bishopric/BishopricLiveView";

export default async function LiveViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;

  // This page has no edit forms of its own (a clean read-only reference
  // for admins during the meeting -- editing minutes/notes happens on
  // Planning) but had no access check at all until 2026-09-08: anyone
  // with the URL, logged in or not, could read live meeting minutes.
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");
  const isAdmin = profile?.role === "bishopric";

  const meeting = await getMeetingById(meetingId);

  if (!meeting) {
    return <p className="text-slate">Could not load this meeting.</p>;
  }
  // Archived meetings are read-only from here on -- see
  // app/meetings/[id]/archived (the "agenda as it was finalized" view).
  if (meeting.stage === "archived") {
    redirect(`/meetings/${meetingId}/archived`);
  }

  if (!isAdmin) {
    // BishopricLiveView shows minutes/notes unconditionally -- it has no
    // "hidden until archived" logic of its own, so a non-admin (even one
    // with real calling-based access) goes to the read-only view instead,
    // which already gets that rule right. Admins keep this page as their
    // clean reference view during the meeting.
    redirect(`/meetings/${meetingId}/archived`);
  }

  if (meeting.meetingType === "bishopric-meeting") {
    const data = await getBishopricMeetingData(meetingId);
    return <BishopricLiveView data={data} />;
  }

  if (meeting.meetingType === "ward-council" || meeting.meetingType === "youth-council") {
    const notes = await getCouncilNotes(meetingId);
    return (
      <div className="rounded-lg border border-rule bg-card p-6">
        {notes?.notes ? (
          <p className="text-lg leading-relaxed text-ink">{notes.notes}</p>
        ) : (
          <p className="text-slate">No notes entered yet.</p>
        )}
      </div>
    );
  }

  return <p className="text-slate">Nothing to show here for this meeting type.</p>;
}
