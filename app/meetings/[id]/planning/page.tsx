import { redirect } from "next/navigation";
import { getMeetingById } from "@/lib/data/meetings";
import {
  getMeetingWithType,
  getTemplateElements,
  getPlannedElements,
  getRoleAssignments,
} from "@/lib/data/meeting-elements";
import { getElementNotes } from "@/lib/data/meeting-element-notes";
import { getSacramentPlanningData } from "@/lib/data/sacrament-planning";
import { getActivePeople } from "@/lib/data/people";
import { getActiveCallings } from "@/lib/data/callings";
import { getBishopricMeetingData, getAgendaItemsForMeeting } from "@/lib/data/bishopric-meeting";
import { getCouncilNotes } from "@/lib/data/council-notes";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { buildAgendaRows } from "@/lib/data/agenda-rows";
import { AgendaGridForm } from "@/components/planning/AgendaGridForm";
import { PlanningInfoForm } from "@/components/planning/PlanningInfoForm";
import { RabnmSection } from "@/components/planning/RabnmSection";
import { BishopricMinutesForm } from "@/components/bishopric/BishopricMinutesForm";
import { ActionItemsSection } from "@/components/bishopric/ActionItemsSection";
import { AgendaItemsSection } from "@/components/bishopric/AgendaItemsSection";
import { CouncilNotesForm } from "@/components/council/CouncilNotesForm";

/**
 * The planning view, rebuilt 2026-09-09 around a single agenda grid --
 * the user's own request, with their real spreadsheet agenda as the
 * reference: "I want them to also be more agenda-like. single line for
 * each element with a field that can be edited after being pre-filled."
 *
 * What changed: every agenda element is now one line in one grid, in
 * the meeting's own element order, with one "Save All Changes" button.
 * Music and Speakers used to be pulled *out* of the agenda and rendered
 * as their own big sections underneath (so hymns and speakers appeared
 * out of order, away from the agenda they belong to); they're inline
 * rows now, resolved against the same sacrament_music /
 * sacrament_speakers_* tables as before. Ward/Stake Business, which
 * used to render here as a dead "Edit in Meeting Info above" pointer,
 * are real editable rows too.
 *
 * What deliberately stays its own section below the grid: the
 * collections that add and remove rows rather than filling in a fixed
 * line -- RABNM, Agenda Items, Action Items -- plus Bishopric Minutes,
 * Council Notes, and Meeting Info (special format + hidden notes).
 */
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
  const isAdmin = profile?.role === "bishopric";
  const canEditRabnm = isAdmin;

  const meeting = await getMeetingById(meetingId);
  if (!meeting) {
    return <p className="text-slate">Could not load this meeting.</p>;
  }
  // Editing is admin-only (2026-09-08 -- this page previously had no
  // role check at all, so any logged-in account could edit any
  // meeting's assignments/music/speakers/free-text elements). Everyone
  // else gets redirected to the read-only view, which enforces its own
  // calling-based access and stage rules from there.
  if (!isAdmin) {
    redirect(`/meetings/${meetingId}/archived`);
  }
  // Archived meetings are read-only from here on -- see
  // app/meetings/[id]/archived (the "agenda as it was finalized" view).
  if (meeting.stage === "archived") {
    redirect(`/meetings/${meetingId}/archived`);
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

  // Agenda Items is the one element with a real add/review section of its
  // own below -- a grid row for it would just be a label with nothing to
  // type into.
  const hasAgendaItemsElement = templateElements.some((el) => el.key === "agenda_items");
  const agendaRows = buildAgendaRows({
    elements: templateElements.filter((el) => el.key !== "agenda_items"),
    roleAssignments,
    elementNotes,
    isSacrament,
    planning: sacramentData?.planning ?? null,
    music: sacramentData?.music ?? [],
    speakersAdults: sacramentData?.speakersAdults ?? [],
    speakersYouth: sacramentData?.speakersYouth ?? [],
  });

  return (
    <div className="flex flex-col gap-6">
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
          <p className="mt-1 text-xs text-slate">
            Every element on this meeting&rsquo;s agenda, in order. Edit any line, then save once.
            Add, remove, or reorder the lines themselves in the{" "}
            <a href={`/meetings/${meetingId}/template`} className="underline">
              agenda editor
            </a>
            .
          </p>
          <div className="mt-4">
            <AgendaGridForm
              meetingId={meetingId}
              roleTable={roleTable}
              rows={agendaRows}
              people={people}
            />
          </div>
        </div>
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

      {hasAgendaItemsElement && <AgendaItemsSection meetingId={meetingId} items={agendaItems} />}

      {isCouncil && <CouncilNotesForm meetingId={meetingId} notes={councilNotes} />}

      {isSacrament && sacramentData && (
        <PlanningInfoForm meetingId={meetingId} planning={sacramentData.planning} />
      )}
    </div>
  );
}
