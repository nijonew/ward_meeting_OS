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
import { getCurrentHolderIdByCallingName } from "@/lib/data/callings";
import { getBishopricMeetingData, getAgendaItemsForMeeting } from "@/lib/data/bishopric-meeting";
import { getCouncilNotes } from "@/lib/data/council-notes";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getEligiblePeopleByElementKey } from "@/lib/data/rotations";
import { buildAgendaRows, type AgendaRow } from "@/lib/data/agenda-rows";
import { getSacramentProgramItems, resolveProgramItems } from "@/lib/data/sacrament-program";
import { SPECIAL_FORMATS } from "@/lib/data/sacrament-constants";
import { savePlanningInfo } from "@/app/meetings/[id]/planning/actions";
import { AgendaGridForm } from "@/components/planning/AgendaGridForm";
import { CombinedAgendaGrids } from "@/components/planning/CombinedAgendaGrids";
import { SacramentProgramSection } from "@/components/planning/SacramentProgramSection";
import { BishopricMinutesForm } from "@/components/bishopric/BishopricMinutesForm";
import { ActionItemsSection } from "@/components/bishopric/ActionItemsSection";
import { AgendaItemsSection } from "@/components/bishopric/AgendaItemsSection";
import { CouncilNotesForm } from "@/components/council/CouncilNotesForm";

/**
 * The planning view, rebuilt 2026-09-09 around a single agenda grid --
 * the user's own request, with their real spreadsheet agenda as the
 * reference: "I want them to also be more agenda-like. single line for
 * each element with a field that can be edited after being pre-filled."
 * Reworked again the same day, line by line, from the user's own notes
 * against a real agenda screenshot -- see lib/data/agenda-rows.ts for
 * the full per-row writeup of what changed and why.
 *
 * Sacrament Meeting's agenda is split into four named sections
 * (2026-09-10, the user's own request): Opening, Administration of the
 * Sacrament, Teaching Program, Closing. Opening/Administration/Closing
 * are synthesized section-divider rows inside buildAgendaRows itself
 * (Opening prepended here since it's tied to *being the first segment*,
 * not to a specific element key the way the other two are); Teaching
 * Program is the heading right above `SacramentProgramSection`, since
 * that section's content lives outside any AgendaGridForm entirely.
 *
 * The grid is genuinely two separate `<form>`s for Sacrament Meeting --
 * everything through Administration of the Sacrament, then (after
 * Teaching Program's own add/remove list) Closing Hymn/Prayer -- rather
 * than one, because Teaching Program's own add/remove/save controls
 * can't be real `<form>`s nested inside a bigger one (HTML forbids
 * nested forms); splitting the grid around it, instead of moving it to
 * its own page, keeps everything in one continuous flow on this page
 * (2026-09-10, the user's own follow-up: "move the speaker/music
 * management items directly into the agenda rather than by link").
 *
 * What deliberately stays its own section below the grid: the
 * collections that add and remove rows rather than filling in a fixed
 * line -- Agenda Items, Action Items -- plus Bishopric Minutes and
 * Council Notes. Ward Business still moves to its own page
 * (/meetings/[id]/ward-business) -- only Speakers & Music came back
 * inline, per the user's specific request. "Meeting Info" as its own
 * section is gone (2026-09-09, the user's own request: "delete the
 * meeting info section") -- Special Format moved to a small control at
 * the very top of the page (below); Hidden Notes wasn't carried
 * anywhere else.
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

  const meeting = await getMeetingById(meetingId);
  if (!meeting) {
    return <p className="text-ink-muted">Could not load this meeting.</p>;
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
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }

  const isSacrament = meeting.meetingType === "sacrament-meeting";
  const isBishopric = meeting.meetingType === "bishopric-meeting";
  const isCouncil = meeting.meetingType === "ward-council" || meeting.meetingType === "youth-council";
  const roleTable = isSacrament ? "sacrament_assignments" : "bishopric_assignments";

  const [plannedElements, people, roleAssignments, elementNotes, sacramentData, programItems] = await Promise.all([
    getPlannedElements(meetingId),
    getActivePeople(),
    getRoleAssignments(meetingId, roleTable),
    getElementNotes(meetingId),
    isSacrament ? getSacramentPlanningData(meetingId) : Promise.resolve(null),
    isSacrament ? getSacramentProgramItems(meetingId) : Promise.resolve([]),
  ]);

  // Meetings created before the per-meeting agenda existed have zero
  // planned-element rows (nothing was ever seeded for them) -- fall back
  // to the shared default template by type (+ special_format, for
  // Sacrament Meeting) so they keep rendering exactly as before.
  const templateElements =
    plannedElements.length > 0
      ? plannedElements
      : await getTemplateElements(meetingWithType.meetingTypeId, isSacrament ? sacramentData?.planning?.special_format ?? "standard" : null);

  const bishopricData = isBishopric ? await getBishopricMeetingData(meetingId) : null;
  const councilNotes = isCouncil ? await getCouncilNotes(meetingId) : null;
  // agenda_items is a general catalog element any meeting type's template
  // can include -- fetched independently of meeting type so it works
  // everywhere, not just Bishopric Meeting.
  const agendaItems = await getAgendaItemsForMeeting(meetingId);

  // Agenda Items and Ward Business are the two elements with a real
  // add/review section of their own (this page and /meetings/[id]/ward-
  // business, respectively) -- a grid row for either would just be a
  // label with nothing to type into.
  const hasAgendaItemsElement = templateElements.some((el) => el.key === "agenda_items");
  const elementsForGrid: TemplateElementRow[] = templateElements.filter((el) => el.key !== "agenda_items");

  // Split the agenda in two around Teaching Program (Sacrament Meeting
  // only) -- everything before Closing Hymn/Prayer, then Closing
  // Hymn/Prayer itself. See this file's own top comment for why this
  // needs to be two <form>s instead of one.
  const closingIndex = elementsForGrid.findIndex((el) => el.key === "closing_hymn" || el.key === "closing_prayer");
  const openingElements = isSacrament && closingIndex !== -1 ? elementsForGrid.slice(0, closingIndex) : elementsForGrid;
  const closingElements = isSacrament && closingIndex !== -1 ? elementsForGrid.slice(closingIndex) : [];

  // Calling-restricted dropdowns (2026-09-09: "all dropdowns should
  // follow the rules for the field by calling") -- one batched lookup
  // for every person_role element actually on this agenda, plus
  // chorister/organist (folded into the Recognize Music row, but still
  // resolved the same way) and presiding/conducting (fixed-by-calling,
  // resolved specially inside getEligiblePeopleByElementKey itself).
  const personRoleKeys = elementsForGrid.filter((el) => el.resolution_kind === "person_role").map((el) => el.key);
  const eligibilityKeys = isSacrament ? Array.from(new Set([...personRoleKeys, "chorister", "organist"])) : personRoleKeys;
  const [eligibilityByKey, defaultPresidingId] = await Promise.all([
    getEligiblePeopleByElementKey(meeting.meetingType, meetingWithType.meetingTypeId, eligibilityKeys),
    isSacrament ? getCurrentHolderIdByCallingName("Bishop") : Promise.resolve(null),
  ]);

  const rowInputs = {
    roleAssignments,
    elementNotes,
    isSacrament,
    planning: sacramentData?.planning ?? null,
    music: sacramentData?.music ?? [],
    speakersAdults: sacramentData?.speakersAdults ?? [],
    speakersYouth: sacramentData?.speakersYouth ?? [],
    eligibilityByKey,
    allPeople: people,
    defaultPresidingId,
    meetingId,
  };

  const openingRows: AgendaRow[] = isSacrament
    ? [{ kind: "section", id: "opening-section", label: "Opening" }, ...buildAgendaRows({ elements: openingElements, ...rowInputs })]
    : buildAgendaRows({ elements: openingElements, ...rowInputs });
  const closingRows = buildAgendaRows({ elements: closingElements, ...rowInputs });

  const resolvedProgramItems = isSacrament
    ? resolveProgramItems(programItems, sacramentData?.music ?? [], sacramentData?.speakersAdults ?? [], sacramentData?.speakersYouth ?? [])
    : [];

  const saveFormat = async (formData: FormData) => {
    "use server";
    await savePlanningInfo(meetingId, formData);
  };

  return (
    <div className="flex flex-col gap-6">
      {isSacrament && sacramentData && (
        <form action={saveFormat} className="flex items-center gap-2 text-sm text-ink-muted">
          Format
          <select
            name="special_format"
            defaultValue={sacramentData.planning?.special_format ?? "standard"}
            className="rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
          >
            {SPECIAL_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5">
            Save
          </button>
        </form>
      )}

      {templateElements.length === 0 ? (
        <div className="rounded border border-rule bg-surface p-6">
          <p className="text-sm text-ink-muted">
            No agenda elements yet. Add some in the{" "}
            <a href={`/meetings/${meetingId}/template`} className="underline">
              agenda editor
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Agenda</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Every element on this meeting&rsquo;s agenda, in order. Edit any line, then save once.
            Add, remove, or reorder the lines themselves in the{" "}
            <a href={`/meetings/${meetingId}/template`} className="underline">
              agenda editor
            </a>
            .
          </p>
          <div className="mt-4">
            {isSacrament ? (
              <CombinedAgendaGrids
                meetingId={meetingId}
                roleTable={roleTable}
                openingRows={openingRows}
                closingRows={closingRows}
                people={people}
              >
                <div className="border-t-2 border-rule pt-4">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">
                    Teaching Program
                  </span>
                  <SacramentProgramSection meetingId={meetingId} items={resolvedProgramItems} people={people} />
                </div>
              </CombinedAgendaGrids>
            ) : (
              <AgendaGridForm meetingId={meetingId} roleTable={roleTable} rows={openingRows} people={people} />
            )}
          </div>
        </div>
      )}

      {isBishopric && bishopricData && (
        <>
          <BishopricMinutesForm meetingId={meetingId} minutes={bishopricData.minutes} people={people} />
          <ActionItemsSection meetingId={meetingId} items={bishopricData.actionItems} people={people} />
        </>
      )}

      {hasAgendaItemsElement && <AgendaItemsSection meetingId={meetingId} items={agendaItems} />}

      {isCouncil && <CouncilNotesForm meetingId={meetingId} notes={councilNotes} />}
    </div>
  );
}
