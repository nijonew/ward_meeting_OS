import { getMeetingById } from "@/lib/data/meetings";

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

  return <p className="text-ink-muted">Choose a view above to get started.</p>;
}
