import { redirect } from "next/navigation";
import { getMeetingById } from "@/lib/data/meetings";
import { getSacramentPlanningData } from "@/lib/data/sacrament-planning";
import { getActivePeople } from "@/lib/data/people";
import { getActiveCallings } from "@/lib/data/callings";
import { getBishopricMeetingData } from "@/lib/data/bishopric-meeting";
import { getCouncilNotes } from "@/lib/data/council-notes";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { SPEAKER_SLOTS_ADULT, SPEAKER_SLOTS_YOUTH } from "@/lib/data/sacrament-constants";
import { PlanningInfoForm } from "@/components/planning/PlanningInfoForm";
import { AssignmentsForm } from "@/components/planning/AssignmentsForm";
import { SpeakersForm } from "@/components/planning/SpeakersForm";
import { RabnmSection } from "@/components/planning/RabnmSection";
import { MusicArrangeSection } from "@/components/planning/MusicArrangeSection";
import { BishopricMinutesForm } from "@/components/bishopric/BishopricMinutesForm";
import { BishopricAssignmentsForm } from "@/components/bishopric/BishopricAssignmentsForm";
import { ActionItemsSection } from "@/components/bishopric/ActionItemsSection";
import { AgendaItemsSection } from "@/components/bishopric/AgendaItemsSection";
import { CouncilNotesForm } from "@/components/council/CouncilNotesForm";

export default async function PlanningViewPage({
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

  if (meeting.meetingType === "bishopric-meeting") {
    const [data, people] = await Promise.all([getBishopricMeetingData(meetingId), getActivePeople()]);
    return (
      <div className="flex flex-col gap-6">
        <BishopricMinutesForm meetingId={meetingId} minutes={data.minutes} people={people} />
        <BishopricAssignmentsForm meetingId={meetingId} assignments={data.assignments} people={people} />
        <ActionItemsSection meetingId={meetingId} items={data.actionItems} people={people} />
        <AgendaItemsSection meetingId={meetingId} items={data.agendaItems} />
      </div>
    );
  }

  if (meeting.meetingType === "ward-council" || meeting.meetingType === "youth-council") {
    const notes = await getCouncilNotes(meetingId);
    return <CouncilNotesForm meetingId={meetingId} notes={notes} />;
  }

  // sacrament-meeting
  const [data, people, callings] = await Promise.all([
    getSacramentPlanningData(meetingId),
    getActivePeople(),
    getActiveCallings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PlanningInfoForm meetingId={meetingId} planning={data.planning} />
      <AssignmentsForm meetingId={meetingId} assignments={data.assignments} people={people} />
      <SpeakersForm
        meetingId={meetingId}
        title="Speakers - Adults"
        variant="adults"
        slots={SPEAKER_SLOTS_ADULT}
        speakers={data.speakersAdults}
        people={people}
      />
      <SpeakersForm
        meetingId={meetingId}
        title="Speakers - Youth"
        variant="youth"
        slots={SPEAKER_SLOTS_YOUTH}
        speakers={data.speakersYouth}
        people={people}
      />
      <MusicArrangeSection meetingId={meetingId} music={data.music} />
      <RabnmSection meetingId={meetingId} items={data.rabnm} people={people} callings={callings} />
    </div>
  );
}
