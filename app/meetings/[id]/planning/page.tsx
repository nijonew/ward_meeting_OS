import { redirect } from "next/navigation";
import { getMeetingById } from "@/lib/data/meetings";
import {
  getMeetingWithType,
  getTemplateElements,
  getPlannedElements,
  getApplicableElements,
  getRoleAssignments,
  seedPlannedElementsForMeeting,
  type TemplateElementRow,
} from "@/lib/data/meeting-elements";
import { getElementNotes } from "@/lib/data/meeting-element-notes";
import { getSacramentPlanningData } from "@/lib/data/sacrament-planning";
import { getActivePeople } from "@/lib/data/people";
import { getCurrentHolderIdByCallingName } from "@/lib/data/callings";
import { getBishopricMeetingData, getAgendaItemsForMeeting } from "@/lib/data/bishopric-meeting";
import { getCouncilNotes } from "@/lib/data/council-notes";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { meetingFeature } from "@/lib/data/meeting-features";
import { getEligiblePeopleByElementKey, getMeetingAttendeePeople } from "@/lib/data/rotations";
import { buildAgendaRows, splitIntoSections, type AgendaRow } from "@/lib/data/agenda-rows";
import { getAnnouncementsForMeetingReview, getPreviousMeetingMinutes } from "@/lib/data/meeting-review";
import { getSacramentProgramItems, resolveProgramItems } from "@/lib/data/sacrament-program";
import { getHymnalIndex } from "@/lib/data/hymnal";
import { getVisitingAuthorities } from "@/lib/data/visiting-authorities";
import { getCallableCallingPlanningItems, autoAnnounceReadyCallingPlanningItems } from "@/lib/data/calling-planning";
import { getCallableRabnmPlanningItems } from "@/lib/data/sacrament-rabnm-planning";
import {
  getAnnouncementsByPlannedElement,
  getPullableAnnouncements,
  autoPullSacramentAnnouncements,
  type PulledAnnouncement,
} from "@/lib/data/sacrament-announcements";
import { SPECIAL_FORMATS } from "@/lib/data/sacrament-constants";
import { getWardBusinessSectionOrder, WARD_BUSINESS_SECTION_KEYS } from "@/lib/data/ward-settings";
import { savePlanningInfo } from "@/app/meetings/[id]/planning/actions";
import { AgendaGridForm } from "@/components/planning/AgendaGridForm";
import { AgendaElementsManager } from "@/components/planning/AgendaElementsManager";
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
 * Council Notes. Ward Business moved back inline too (2026-10-03, see
 * lib/data/agenda-rows.ts's own `ward_business` row-kind comment) --
 * Speakers & Music and Ward Business are now the only two
 * non-standalone-page exceptions to the grid, per the user's own
 * requests for each. "Meeting Info" as its own
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

  const meeting = await getMeetingById(meetingId);
  if (!meeting) {
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }
  // No cancelled check here (removed 2026-10-04, the same day it was
  // added) -- this page is never reached by anyone who isn't already
  // this meeting type's own planner (see the redirect right below),
  // so blocking on `cancelled` here only ever blocked the planner
  // themselves, breaking "Planning is the default view for planners"
  // in exactly the one case (a cancelled meeting) where they most need
  // to get in -- e.g. to confirm an accidental duplicate before
  // deleting it from the dashboard, or to un-cancel it. The layout's
  // own Cancelled badge already shows this meeting is cancelled; see
  // app/meetings/[id]/public/page.tsx for where the cancelled check
  // actually belongs (the one page a non-planner can reach).
  // Editing requires this specific meeting type's own planning feature
  // (2026-10-04, replacing a single blanket "bishopric" check -- see
  // PROJECT_CONTEXT.md's Architecture section). Before 2026-09-08 this
  // page had no check at all, so any logged-in account could edit any
  // meeting's assignments/music/speakers/free-text elements; everyone
  // lacking the feature gets redirected to the read-only view, which
  // enforces its own calling-based access and stage rules from there.
  const isAdmin = hasFeature(profile, meetingFeature(meeting.meetingType, "planning"));
  if (!isAdmin) {
    redirect(`/meetings/${meetingId}/archived`);
  }
  // Archived meetings are read-only from here on -- see
  // app/meetings/[id]/archived (the "agenda as it was finalized" view).
  if (meeting.stage === "archived") {
    redirect(`/meetings/${meetingId}/archived`);
  }

  const isSacrament = meeting.meetingType === "sacrament-meeting";
  const isBishopric = meeting.meetingType === "bishopric-meeting";
  const isCouncil = meeting.meetingType === "ward-council" || meeting.meetingType === "youth-council";
  const roleTable = isSacrament ? "sacrament_assignments" : "bishopric_assignments";

  // Doesn't need anything from either sweep below, so its own fetch
  // runs concurrently with them instead of blocking on it first
  // (2026-10-31, chasing the user's own "this app is extremely slow"
  // report).
  const meetingWithTypePromise = getMeetingWithType(meetingId);

  // Auto-adds every "To be Announced" Calling Planning item (calling
  // and release sides independently) to whichever Sacrament Meeting is
  // nearest-upcoming right now (2026-10-15, the user's own request:
  // "I would like to have those calling and release announcement
  // automatically added to the next sacrament meeting... each week
  // until their status is changed"). Lazy sweep, same pattern as
  // autoArchivePastMeetings/sweepMeetingCancellations -- run before the
  // fetch below so this page's own `sacramentData.rabnm`/
  // `callablePlanningItems` already reflect it on first render. Only
  // ever writes to the single nearest-upcoming meeting (see that
  // function's own doc comment), regardless of which Sacrament Meeting
  // is actually being viewed here, so it's safe to call unconditionally.
  if (isSacrament) {
    // Both sweeps touch entirely different tables for independent
    // purposes (calling_planning/sacrament_rabnm vs.
    // announcements/sacrament_announcement_pulls), so they run
    // together rather than one after the other. The second one is:
    // auto-fills this meeting's Announcements block with every
    // "Sacrament Meeting"-flagged announcement currently in its active
    // window (2026-10-25, migration 083) -- see that function's own
    // doc comment. Unlike the sweep above, this isn't scoped to a
    // single "nearest upcoming" meeting -- a recurring announcement
    // should land in every applicable meeting, so it needs to run
    // fresh against whichever meeting's Planning page is actually
    // being viewed.
    await Promise.all([autoAnnounceReadyCallingPlanningItems(), autoPullSacramentAnnouncements(meetingId, meeting.date)]);
  }

  const meetingWithType = await meetingWithTypePromise;
  if (!meetingWithType) {
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }

  const [
    plannedElements,
    activePeople,
    roleAssignments,
    elementNotes,
    sacramentData,
    programItems,
    hymnalIndex,
    visitingAuthorities,
    callablePlanningItems,
    callableRabnm,
    wardBusinessSectionOrder,
    announcementsByPlannedElement,
    pullableAnnouncements,
    applicableElements,
    attendeePeople,
    bishopricData,
    councilNotes,
    agendaItems,
  ] = await Promise.all([
    getPlannedElements(meetingId),
    getActivePeople(),
    getRoleAssignments(meetingId, roleTable),
    getElementNotes(meetingId),
    isSacrament ? getSacramentPlanningData(meetingId) : Promise.resolve(null),
    isSacrament ? getSacramentProgramItems(meetingId) : Promise.resolve([]),
    // Only Sacrament Meeting's agenda ever has a hymn-number field, but
    // fetching this unconditionally (it's small -- a few hundred rows)
    // is simpler than threading an isSacrament check through every
    // caller that needs it (2026-10-03, live hymn-title pre-fill --
    // see components/planning/AgendaGridForm.tsx's MusicCell).
    getHymnalIndex(),
    isSacrament ? getVisitingAuthorities(meetingId) : Promise.resolve([]),
    // Ward Business's inline Calling Planning picker (2026-10-03) --
    // small enough (every not-yet-announced row, ward-wide) to fetch
    // unconditionally rather than threading isSacrament through here too.
    isSacrament
      ? getCallableCallingPlanningItems()
      : Promise.resolve({ callings: [], releases: [] }),
    // Ward Business's RABNM-planning third section (2026-10-24) -- same
    // reasoning, small enough (every not-yet-announced pool row,
    // ward-wide) to fetch unconditionally.
    isSacrament ? getCallableRabnmPlanningItems() : Promise.resolve([]),
    // Which order Ward Business's three subsections render in (migration
    // 091) -- a ward-wide preference, not per-meeting.
    isSacrament ? getWardBusinessSectionOrder() : Promise.resolve([...WARD_BUSINESS_SECTION_KEYS]),
    // Announcements' own inline picker (2026-10-11) -- same reasoning
    // as Ward Business's, just for the `announcements` table instead.
    // A map (not a flat list) since a meeting can have more than one
    // Announcements block (migration 074) -- see that file's own
    // comment.
    isSacrament ? getAnnouncementsByPlannedElement(meetingId) : Promise.resolve(new Map<string, PulledAnnouncement[]>()),
    isSacrament ? getPullableAnnouncements(meetingId) : Promise.resolve([]),
    // These five only need meetingId/meetingWithType.meetingTypeId --
    // none of them reads back anything the two sweeps above wrote, or
    // anything else in this same array -- so they're folded into this
    // one wave instead of five more sequential awaits further down
    // (2026-10-31, chasing the user's own "this app is extremely slow"
    // report).
    getApplicableElements(meetingWithType.meetingTypeId),
    isSacrament ? Promise.resolve([]) : getMeetingAttendeePeople(meetingWithType.meetingTypeId),
    isBishopric ? getBishopricMeetingData(meetingId) : Promise.resolve(null),
    isCouncil ? getCouncilNotes(meetingId) : Promise.resolve(null),
    getAgendaItemsForMeeting(meetingId),
  ]);

  // Meetings created before the per-meeting agenda existed, or created
  // via a path that didn't seed one (see getOrCreateMeetingId's own
  // matching fix, lib/data/meetings.ts), have zero planned-element
  // rows. Seed this meeting's own rows right now and re-fetch, rather
  // than just rendering the shared template read-only -- the lazy-sweep
  // pattern already used elsewhere on this page
  // (autoAnnounceReadyCallingPlanningItems above).
  //
  // **Bug found and fixed 2026-10-16** (the user's own report: a
  // foreign key violation pulling a previously-used announcement into
  // a meeting's Ward Business): the OLD fallback here rendered
  // `getTemplateElements`'s rows directly -- whose own `id` is
  // `meeting_templates.id`, a shared, generic row, never a real
  // per-meeting one. Every `AgendaRow`'s `id` comes straight from
  // whichever element list this page renders, so anything that needs
  // to reference a SPECIFIC meeting's own agenda line (pulling an
  // announcement into one, via `sacrament_announcement_pulls
  // .planned_element_id`) was silently being handed a `meeting_templates`
  // id that could never exist in `meeting_planned_elements`, which that
  // column's own foreign key requires. We've already confirmed above
  // this meeting isn't archived, so persisting real rows here is safe
  // -- it only ever happens for a meeting still being actively planned,
  // never one whose finalized history should stay frozen (that's
  // `archived/page.tsx`'s own, deliberately separate, un-seeded
  // fallback rendering -- unchanged).
  let resolvedPlannedElements = plannedElements;
  if (resolvedPlannedElements.length === 0) {
    await seedPlannedElementsForMeeting(
      meetingId,
      meetingWithType.meetingTypeId,
      isSacrament ? sacramentData?.planning?.special_format ?? "standard" : null
    );
    resolvedPlannedElements = await getPlannedElements(meetingId);
  }
  // Still empty only when there's truly no default template to seed
  // from at all (no row in meeting_templates for this type/format) --
  // the one case seedPlannedElementsForMeeting itself can't fix.
  const templateElements =
    resolvedPlannedElements.length > 0
      ? resolvedPlannedElements
      : await getTemplateElements(meetingWithType.meetingTypeId, isSacrament ? sacramentData?.planning?.special_format ?? "standard" : null);

  // Inline Agenda Elements management (2026-10-25) -- every catalog
  // element for this meeting type that isn't already on this specific
  // meeting's own agenda, same "add once, except announcements" rule
  // the standalone /meetings/[id]/template page already enforces.
  // (`applicableElements` itself was fetched above, in the main wave.)
  const includedElementIds = new Set(templateElements.map((e) => e.element_id));
  const availableElements = applicableElements.filter((e) => !includedElementIds.has(e.id) || e.key === "announcements");

  // Every person-picker on this page falls back to "the whole ward" by
  // default (`allPeople`/`people`, below) -- restricted to this meeting
  // type's own attendees for Bishopric Meeting/Ward Council/Youth
  // Council (2026-10-21, the user's own request: "limit all of the
  // dropdown selections in non-sacrament meetings to only those who
  // attend the meeting. digging through all members is tedious").
  // Sacrament Meeting is deliberately untouched -- it already has its
  // own, more specific per-element calling restrictions
  // (getEligiblePeopleByElementKey) and was never part of this ask.
  // Falls back to every active person if no calling currently maps to
  // this meeting type at all, rather than showing an empty dropdown.
  // (`attendeePeople`/`bishopricData`/`councilNotes`/`agendaItems`
  // were all fetched above, in the main wave.)
  const people = !isSacrament && attendeePeople.length > 0 ? attendeePeople : activePeople;

  // Bishopric Meeting/Ward Council/Youth Council's own sectioned agenda
  // (2026-10-19) -- Devotional/Review/Discussion/Closing, split on the
  // real, freely-movable 'section' catalog elements seeded by migration
  // 078 (see splitIntoSections's own comment). Review's own content
  // (Announcements by where_announced, previous meeting's Minutes) is
  // synthesized here, not stored as a catalog row.
  const collaborativeSections = !isSacrament ? splitIntoSections(templateElements) : [];
  const [reviewAnnouncements, previousMinutes] = !isSacrament
    ? await Promise.all([
        getAnnouncementsForMeetingReview(meeting.meetingType),
        getPreviousMeetingMinutes(meeting.meetingType, meeting.date),
      ])
    : [[], null];

  // Agenda Items and Ward Business are the two elements with a real
  // add/review section of their own (this page and /meetings/[id]/ward-
  // business, respectively) -- a grid row for either would just be a
  // label with nothing to type into.
  //
  // **Agenda Items now renders at its own real template position,
  // 2026-10-11** (the user's own report, going into a Bishopric
  // Meeting/Ward Council/Youth Council meeting: "the agenda items
  // come in at the end of the meeting... it didn't follow the
  // template"). It used to be unconditionally filtered out of the grid
  // and bolted on as a fixed section after Bishopric Minutes/Action
  // Items regardless of where it actually sits in the template's own
  // sort_order -- the non-Sacrament equivalent of the exact bug
  // Announcements/Teaching Program already needed a real split to fix
  // above. `agendaItemsIndex` is computed against the FULL
  // `templateElements` list, before agenda_items is filtered out of
  // the grid, so the split lands exactly where the template says.
  const agendaItemsIndex = templateElements.findIndex((el) => el.key === "agenda_items");
  const elementsForGrid: TemplateElementRow[] = templateElements.filter((el) => el.key !== "agenda_items");
  const beforeAgendaItemsElements =
    !isSacrament && agendaItemsIndex !== -1 ? templateElements.slice(0, agendaItemsIndex) : elementsForGrid;

  // Split the agenda in two around Teaching Program (Sacrament Meeting
  // only) -- everything before Closing Hymn/Prayer, then Closing
  // Hymn/Prayer itself. See this file's own top comment for why this
  // needs to be two <form>s instead of one.
  //
  // An Announcements block immediately before Closing Hymn/Prayer also
  // anchors the closing half (2026-10-11, the user's own request: "add
  // an announcement section before the closing hymn and prayer") --
  // Teaching Program always renders between the two halves regardless
  // of any element's own sort_order, so getting that block to land
  // *after* Teaching Program (not just numerically before Closing
  // Hymn, which alone would still leave it in the opening half)
  // requires it to anchor the closing slice's own start, same as
  // closing_hymn/closing_prayer already do.
  //
  // **Checked by adjacency, not by key alone, since 2026-10-11** -- a
  // meeting can now have more than one Announcements block (migration
  // 074: "I just want the ability to add a second announcement block
  // before the closing hymn/prayer"). Matching on `el.key ===
  // "announcements"` inside the `findIndex` itself would grab whichever
  // block comes FIRST, which is wrong the moment an earlier block
  // exists too (it would wrongly anchor the closing half there,
  // dragging Teaching Program ahead of it). Instead, find Closing
  // Hymn/Prayer's own index first, then only shift the anchor back one
  // slot if the element immediately before it is an Announcements
  // block -- an earlier, unrelated block elsewhere in the agenda is
  // untouched by this and renders inline in the opening half like any
  // other element.
  //
  // For non-Sacrament types, this operates over `beforeAgendaItemsElements`
  // rather than the full `elementsForGrid` -- those types never have
  // Closing Hymn/Prayer/Announcements at all, so `closingIndex` is
  // always -1 there regardless, and `beforeAgendaItemsElements` is
  // already the right (possibly agenda_items-truncated) list to hand
  // to the grid either way.
  let closingIndex = beforeAgendaItemsElements.findIndex((el) => el.key === "closing_hymn" || el.key === "closing_prayer");
  if (closingIndex > 0 && beforeAgendaItemsElements[closingIndex - 1].key === "announcements") {
    closingIndex -= 1;
  }
  const openingElements =
    isSacrament && closingIndex !== -1 ? beforeAgendaItemsElements.slice(0, closingIndex) : beforeAgendaItemsElements;
  const closingElements = isSacrament && closingIndex !== -1 ? beforeAgendaItemsElements.slice(closingIndex) : [];

  // Calling-restricted dropdowns (2026-09-09: "all dropdowns should
  // follow the rules for the field by calling") -- one batched lookup
  // for every person_role element actually on this agenda, plus
  // chorister/organist (folded into the Recognize Music row, but still
  // resolved the same way) and presiding/conducting (fixed-by-calling,
  // resolved specially inside getEligiblePeopleByElementKey itself).
  const personRoleKeys = elementsForGrid.filter((el) => el.resolution_kind === "person_role").map((el) => el.key);
  const eligibilityKeys = isSacrament
    ? Array.from(new Set([...personRoleKeys, "chorister", "organist", "visiting_authorities"]))
    : personRoleKeys;
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
    visitingAuthorities,
    rabnm: sacramentData?.rabnm ?? [],
    callableCallings: callablePlanningItems.callings,
    callableReleases: callablePlanningItems.releases,
    callableRabnm,
    wardBusinessSectionOrder,
    announcementsByPlannedElement,
    pullableAnnouncements,
    eligibilityByKey,
    allPeople: people,
    defaultPresidingId,
    reviewAnnouncements,
    previousMinutes,
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
          <p className="text-sm text-ink-muted">No agenda elements yet. Add one below.</p>
          <AgendaElementsManager meetingId={meetingId} included={templateElements} available={availableElements} />
        </div>
      ) : (
        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Agenda</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Every element on this meeting&rsquo;s agenda, in order. Edit any line, then save once.
            Add, remove, or reorder the lines themselves below, or in the full{" "}
            <a href={`/meetings/${meetingId}/template`} className="underline">
              agenda editor
            </a>
            .
          </p>
          <AgendaElementsManager meetingId={meetingId} included={templateElements} available={availableElements} />
          <div className="mt-4">
            {isSacrament ? (
              <CombinedAgendaGrids
                meetingId={meetingId}
                roleTable={roleTable}
                openingRows={openingRows}
                closingRows={closingRows}
                people={people}
                hymnalIndex={hymnalIndex}
                footer={
                  <label className="mt-4 flex items-center gap-1.5 border-t border-rule/60 pt-4 text-sm text-ink">
                    <input type="hidden" name="planning::ready_for_public" value="" />
                    <input
                      type="checkbox"
                      name="planning::ready_for_public"
                      defaultChecked={sacramentData?.planning?.ready_for_public ?? false}
                    />
                    This meeting is complete and ready for public viewing
                  </label>
                }
              >
                <div className="border-t-2 border-rule pt-4">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">
                    Teaching Program
                  </span>
                  <SacramentProgramSection
                    meetingId={meetingId}
                    items={resolvedProgramItems}
                    people={people}
                    hymnalIndex={hymnalIndex}
                  />
                </div>
              </CombinedAgendaGrids>
            ) : (
              <div className="flex flex-col gap-6">
                {collaborativeSections.map((section, i) => {
                  // Discussion gets real, named treatment (the
                  // agenda_items split); every other section
                  // (Devotional, Review, Closing, and the unlabeled
                  // lead-in before this meeting's first divider -- e.g.
                  // one created before migration 078 seeded one) is
                  // just its own grid of ordinary rows, still
                  // agenda_items-aware so a not-yet-migrated meeting
                  // keeps working exactly as it did before. Review's
                  // own content (Announcements, Previous Meeting
                  // Minutes) used to need its own special case here --
                  // now that both are real elements (2026-10-27,
                  // review_announcements/previous_meeting_minutes),
                  // this generic branch already renders them correctly
                  // in order, same as any other element.
                  const itemsIndex = section.elements.findIndex((el) => el.key === "agenda_items");
                  const before = itemsIndex === -1 ? section.elements : section.elements.slice(0, itemsIndex);
                  const after = itemsIndex === -1 ? [] : section.elements.slice(itemsIndex + 1);

                  if (before.length === 0 && itemsIndex === -1 && after.length === 0) return null;

                  return (
                    <div key={`section-${i}`} className="border-t-2 border-rule pt-6 first:border-t-0 first:pt-0">
                      {section.label && (
                        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">
                          {section.label}
                        </span>
                      )}
                      <div className="mt-3 flex flex-col gap-4">
                        {before.length > 0 && (
                          <AgendaGridForm
                            meetingId={meetingId}
                            roleTable={roleTable}
                            rows={buildAgendaRows({ elements: before, ...rowInputs })}
                            people={people}
                            hymnalIndex={hymnalIndex}
                          />
                        )}
                        {itemsIndex !== -1 && <AgendaItemsSection meetingId={meetingId} items={agendaItems} />}
                        {after.length > 0 && (
                          <AgendaGridForm
                            meetingId={meetingId}
                            roleTable={roleTable}
                            rows={buildAgendaRows({ elements: after, ...rowInputs })}
                            people={people}
                            hymnalIndex={hymnalIndex}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {isBishopric && bishopricData && (
        <>
          <BishopricMinutesForm meetingId={meetingId} minutes={bishopricData.minutes} />
          <ActionItemsSection meetingId={meetingId} items={bishopricData.actionItems} people={people} />
        </>
      )}

      {isCouncil && <CouncilNotesForm meetingId={meetingId} notes={councilNotes} />}
    </div>
  );
}
