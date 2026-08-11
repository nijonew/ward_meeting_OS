import { getMeetingById } from "@/lib/data/meetings";
import { getBishopricMeetingData } from "@/lib/data/bishopric-meeting";
import { getCouncilNotes } from "@/lib/data/council-notes";
import { BishopricLiveView } from "@/components/bishopric/BishopricLiveView";

export default async function LiveViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;
  const meeting = await getMeetingById(meetingId);

  if (!meeting) {
    return <p className="text-slate">Could not load this meeting.</p>;
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
