import { redirect } from "next/navigation";
import { getMeetingById } from "@/lib/data/meetings";
import {
  getMeetingWithType,
  getTemplateElements,
  getPlannedElements,
  getRoleAssignments,
  type TemplateElementRow,
} from "@/lib/data/meeting-elements";
import { getElementNotes } from "@/lib/data/meeting-element-notes";
import { getSacramentPlanningData } from "@/lib/data/sacrament-planning";
import { getActivePeople } from "@/lib/data/people";
import { getActiveCallings } from "@/lib/data/callings";
import { getBishopricMeetingData, getAgendaItemsForMeeting } from "@/lib/data/bishopric-meeting";
import { getCouncilNotes } from "@/lib/data/council-notes";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { SPEAKER_SLOTS_ADULT, SPEAKER_SLOTS_YOUTH } from "@/lib/data/sacrament-constants";
import {
  PersonRoleField,
  FreeTextField,
  PersonAndTextField,
  LabelOnlyField,
} from "@/components/planning/DynamicElementField";
import { PlanningInfoForm } from "@/components/planning/PlanningInfoForm";
import { SpeakersForm } from "@/components/planning/SpeakersForm";
import { RabnmSection } from "@/components/planning/RabnmSection";
import { MusicArrangeSection } from "@/components/planning/MusicArrangeSection";
import { BishopricMinutesForm } from "@/components/bishopric/BishopricMinutesForm";
import { ActionItemsSection } from "@/components/bishopric/ActionItemsSection";
import { AgendaItemsSection } from "@/components/bishopric/AgendaItemsSection";
import { CouncilNotesForm } from "@/components/council/CouncilNotesForm";

// Free-text elements that already have a dedicated, unambiguous home
// elsewhere -- rendering them again here would create two disconnected
// copies of the same field. Shown as a pointer instead of a duplicate
// editor.
const REDIRECT_NOTES: Record<string, string> = {
  ward_business: "Edit in Meeting Info above",
  stake_business: "Edit in Meeting Info above",
};

export default async function PlanningViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;

  const { user, profile } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const canEditRabnm = profile?.role === "bishopric";

  const meeting = await getMeetingById(meetingId);
  if (!meeting) {
    return <p className="text-slate">Could not load this meeting.</p>;
  }

  const meetingWithType = await getMeetingWithType(meetingId);
  if (!meetingWithType) {
    return <p className="text-slate">Could not load this meeting.</p>;
  }

  const isSacrament = meeting.meetingType === "sacrament-meeting";
  const isBishopric = meeting.meetingType === "bishopric-meeting";
  const isCouncil = meeting.meetingType === "ward-council" || meeting.meetingType === "youth-council";
  const roleTable = isSacrament ? "sacrament_assignments" : "bishopric_assignments";

  const [plannedElements, people, roleAssignments, elementNotes, sacramentData] = await Promise.all([
    getPlannedElements(meetingId),
    getActivePeople(),
    getRoleAssignments(meetingId, roleTable),
    getElementNotes(meetingId),
    isSacrament ? getSacramentPlanningData(meetingId) : Promise.resolve(null),
  ]);

  // Meetings created before the per-meeting agenda existed have zero
  // planned-element rows (nothing was ever seeded for them) -- fall back
  // to the shared default template by type (+ special_format, for
  // Sacrament Meeting) so they keep rendering exactly as before.
  const templateElements =
    plannedElements.length > 0
      ? plannedElements
      : await getTemplateElements(meetingWithType.meetingTypeId, isSacrament ? sacramentData?.planning?.special_format ?? "standard" : null);

  const callings = isSacrament ? await getActiveCallings() : [];
  const bishopricData = isBishopric ? await getBishopricMeetingData(meetingId) : null;
  const councilNotes = isCouncil ? await getCouncilNotes(meetingId) : null;
  // agenda_items is a general catalog element any meeting type's template
  // can include -- fetched independently of meeting type so it works
  // everywhere, not just Bishopric Meeting.
  const agendaItems = await getAgendaItemsForMeeting(meetingId);

  const renderedMusicKinds = new Set<string>();
  const renderedSlotKinds = new Set<string>();
  const renderedNoneKinds = new Set<string>();

  function renderElement(el: TemplateElementRow) {
    switch (el.resolution_kind) {
      case "person_role":
        return (
          <PersonRoleField
            key={el.id}
            meetingId={meetingId}
            elementKey={el.key}
            label={el.label}
            table={roleTable}
            people={people}
            value={roleAssignments[el.key]}
          />
        );

      case "free_text":
        if (REDIRECT_NOTES[el.key]) {
          return <LabelOnlyField key={el.id} label={el.label} note={REDIRECT_NOTES[el.key]} />;
        }
        return (
          <FreeTextField
            key={el.id}
            meetingId={meetingId}
            elementKey={el.key}
            label={el.label}
            value={elementNotes[el.key]}
          />
        );

      case "person_and_text":
        return (
          <PersonAndTextField
            key={el.id}
            meetingId={meetingId}
            elementKey={el.key}
            label={el.label}
            people={people}
            value={elementNotes[el.key]}
          />
        );

      case "music":
        // Rendered once, below, via the existing MusicArrangeSection --
        // avoid an empty placeholder per hymn-type element.
        renderedMusicKinds.add(el.key);
        return null;

      case "person_slot":
        // Rendered once per slot type, below, via the existing
        // SpeakersForm -- avoid duplicating the 9-slot form per element.
        renderedSlotKinds.add(el.key);
        return null;

      case "none":
      default: {
        if (el.key === "agenda_items") {
          // Rendered once, below, via AgendaItemsSection -- no
          // placeholder needed since a real section follows.
          renderedNoneKinds.add(el.key);
          return null;
        }
        return <LabelOnlyField key={el.id} label={el.label} />;
      }
    }
  }

  const elementFields = templateElements.map(renderElement).filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      {isSacrament && sacramentData && (
        <PlanningInfoForm meetingId={meetingId} planning={sacramentData.planning} />
      )}

      {templateElements.length === 0 ? (
        <div className="rounded-lg border border-rule bg-card p-6">
          <p className="text-sm text-slate">
            No agenda elements yet. Add some in the{" "}
            <a href={`/meetings/${meetingId}/template`} className="underline">
              agenda editor
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Agenda</h2>
          <div className="mt-4 flex flex-col gap-2">{elementFields}</div>
        </div>
      )}

      {isSacrament && sacramentData && renderedMusicKinds.size > 0 && (
        <MusicArrangeSection meetingId={meetingId} music={sacramentData.music} />
      )}

      {isSacrament && sacramentData && renderedSlotKinds.has("speaker") && (
        <SpeakersForm
          meetingId={meetingId}
          title="Speakers - Adults"
          variant="adults"
          slots={SPEAKER_SLOTS_ADULT}
          speakers={sacramentData.speakersAdults}
          people={people}
        />
      )}

      {isSacrament && sacramentData && renderedSlotKinds.has("youth_speaker") && (
        <SpeakersForm
          meetingId={meetingId}
          title="Speakers - Youth"
          variant="youth"
          slots={SPEAKER_SLOTS_YOUTH}
          speakers={sacramentData.speakersYouth}
          people={people}
        />
      )}

      {isSacrament && sacramentData && (
        <RabnmSection
          meetingId={meetingId}
          items={sacramentData.rabnm}
          people={people}
          callings={callings}
          canEdit={canEditRabnm}
        />
      )}

      {isBishopric && bishopricData && (
        <>
          <BishopricMinutesForm meetingId={meetingId} minutes={bishopricData.minutes} people={people} />
          <ActionItemsSection meetingId={meetingId} items={bishopricData.actionItems} people={people} />
        </>
      )}

      {renderedNoneKinds.has("agenda_items") && (
        <AgendaItemsSection meetingId={meetingId} items={agendaItems} />
      )}

      {isCouncil && <CouncilNotesForm meetingId={meetingId} notes={councilNotes} />}
    </div>
  );
}