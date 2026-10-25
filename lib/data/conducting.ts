import { getMeetingById } from "@/lib/data/meetings";
import { getMeetingWithType, getTemplateElements, getPlannedElements, getRoleAssignments } from "@/lib/data/meeting-elements";
import { getElementNotes } from "@/lib/data/meeting-element-notes";
import { getSacramentPlanningData } from "@/lib/data/sacrament-planning";
import { getActivePeople } from "@/lib/data/people";
import { getSacramentProgramItems, resolveProgramItems, type ResolvedProgramItem } from "@/lib/data/sacrament-program";
import { getVisitingAuthorities } from "@/lib/data/visiting-authorities";
import { getAnnouncementsByPlannedElement } from "@/lib/data/sacrament-announcements";
import { buildConductingRows, type ConductingRow } from "@/lib/data/conducting-rows";
import { getTitlePrefixesForAssignments } from "@/lib/data/person-display";

export interface ConductingScript {
  meetingTitle: string;
  meetingDate: string;
  specialFormat: string;
  rows: ConductingRow[];
}

/** One row per Speakers & Music item, in the meeting's own chosen order
 *  (2026-09-10: this used to be grouped by type -- all youth speakers,
 *  then intermediate hymns, then musical numbers, then adult speakers
 *  -- regardless of the order actually saved; now that the planning
 *  view lets these interleave freely, the script has to follow the
 *  same real order or it stops matching what's on the agenda).
 *  Speaker/Youth Speaker rows are value-only (a name isn't "suggested
 *  wording" the way a hymn intro is, per the user's own scoping of
 *  this redesign); Musical Number/Intermediate Hymn/Testimony/Primary
 *  Program get a suggested line too. */
function programItemRow(item: ResolvedProgramItem, peopleById: Map<string, string>): ConductingRow {
  switch (item.kind) {
    case "speaker":
    case "youth_speaker": {
      const name = item.personId ? peopleById.get(item.personId) ?? "(not entered)" : item.guestName || "(not entered)";
      return { id: item.id, kind: "field", label: item.label, value: name, wording: null };
    }
    case "musical_number": {
      const performer = item.performer || "(performer not entered)";
      return {
        id: item.id,
        kind: "field",
        label: item.label,
        value: `${item.title || "(title not entered)"} — ${performer}`,
        wording: `We will now be favored with a musical number, "${item.title || "(title not entered)"}", performed by ${performer}.`,
      };
    }
    case "intermediate_hymn":
      return {
        id: item.id,
        kind: "field",
        label: item.label,
        value: `${item.hymnNumber || "?"} ${item.title || "(title not entered)"}`.trim(),
        wording: `Intermediate hymn number ${item.hymnNumber || "?"}, ${item.title || "(title not entered)"}.`,
      };
    case "testimony":
      return {
        id: item.id,
        kind: "banner",
        label: "Testimonies",
        value: null,
        wording: "We now invite members of the ward to bear their testimonies.",
      };
    case "primary_program":
      // Added 2026-10-24 -- a real case, not the old shared default
      // with testimony: both used to fall into one `case "testimony":
      // default:` block, which would have wrongly announced "We now
      // invite members of the ward to bear their testimonies" for a
      // Primary Program item once this kind existed.
      return {
        id: item.id,
        kind: "banner",
        label: "Primary Program",
        value: null,
        wording: "We now invite the Primary to present their program.",
      };
    default:
      return {
        id: item.id,
        kind: "banner",
        label: item.label,
        value: null,
        wording: null,
      };
  }
}

/**
 * The Conducting view's data, rebuilt 2026-09-10 to be template-driven
 * the same way Planning already is -- see lib/data/conducting-rows.ts
 * for the full writeup of why and what changed. Walks the meeting's own
 * `meeting_planned_elements`/`meeting_templates` (same fallback as
 * Planning for a meeting with none seeded) instead of a hand-written
 * fixed sequence, so per-meeting agenda customization and
 * `special_format` variations are automatically reflected here too --
 * no more separate hardcoded special-cases silently drifting out of
 * sync with what Planning actually supports.
 */
export async function getConductingRows(meetingId: string): Promise<ConductingScript | null> {
  const meeting = await getMeetingById(meetingId);
  if (!meeting) return null;

  const meetingWithType = await getMeetingWithType(meetingId);
  if (!meetingWithType) return null;

  const [plannedElements, roleAssignments, elementNotes, data, people, programItems, visitingAuthorities, announcementsByPlannedElement] =
    await Promise.all([
      getPlannedElements(meetingId),
      getRoleAssignments(meetingId, "sacrament_assignments"),
      getElementNotes(meetingId),
      getSacramentPlanningData(meetingId),
      getActivePeople(),
      getSacramentProgramItems(meetingId),
      getVisitingAuthorities(meetingId),
      getAnnouncementsByPlannedElement(meetingId),
    ]);

  const templateElements =
    plannedElements.length > 0
      ? plannedElements
      : await getTemplateElements(meetingWithType.meetingTypeId, data.planning?.special_format ?? "standard");

  const peopleById = new Map(people.map((p) => [p.id, p.name]));

  // Split at Closing Hymn/Prayer (or Announcements, when a block sits
  // immediately before one, 2026-10-11 -- see the identical comment in
  // app/meetings/[id]/planning/page.tsx for why), the exact same
  // boundary that page uses for the editable grid -- duplicated rather
  // than shared, since it's a handful of lines and the two call sites
  // are a Server Component and a data module.
  const elementsForGrid = templateElements.filter((el) => el.key !== "agenda_items");
  let closingIndex = elementsForGrid.findIndex((el) => el.key === "closing_hymn" || el.key === "closing_prayer");
  if (closingIndex > 0 && elementsForGrid[closingIndex - 1].key === "announcements") {
    closingIndex -= 1;
  }
  const openingElements = closingIndex !== -1 ? elementsForGrid.slice(0, closingIndex) : elementsForGrid;
  const closingElements = closingIndex !== -1 ? elementsForGrid.slice(closingIndex) : [];

  // "Title + last name" (2026-10-21) -- one batched lookup for every
  // elementKey/personId pair this script is about to render, covering
  // both person_role and person_and_text elements plus the Chorister/
  // Organist pair recognize_music resolves separately. See
  // getTitlePrefixesForAssignments (lib/data/person-display.ts).
  const titlePairs: { elementKey: string; personId: string }[] = [];
  for (const el of elementsForGrid) {
    if (el.key === "recognize_music") {
      for (const role of ["chorister", "organist"]) {
        const id = roleAssignments[role]?.assigned_to_id;
        if (id) titlePairs.push({ elementKey: role, personId: id });
      }
      continue;
    }
    if (el.resolution_kind === "person_role") {
      const id = roleAssignments[el.key]?.assigned_to_id;
      if (id) titlePairs.push({ elementKey: el.key, personId: id });
    } else if (el.resolution_kind === "person_and_text") {
      const id = elementNotes[el.key]?.person_id;
      if (id) titlePairs.push({ elementKey: el.key, personId: id });
    }
  }
  const titlePrefixByKey = await getTitlePrefixesForAssignments("sacrament-meeting", titlePairs);

  const rowInputs = {
    roleAssignments,
    elementNotes,
    planning: data.planning,
    music: data.music,
    rabnm: data.rabnm,
    visitingAuthorities,
    announcementsByPlannedElement,
    peopleById,
    titlePrefixByKey,
  };

  const rows: ConductingRow[] = [
    {
      id: "title",
      kind: "banner",
      label: "Title",
      value: null,
      wording: "Welcome to today's Sacrament Meeting of The Church of Jesus Christ of Latter-day Saints.",
    },
    { id: "opening-section", kind: "section", label: "Opening", value: null, wording: null },
    ...buildConductingRows({ elements: openingElements, ...rowInputs }),
    { id: "teaching-program-section", kind: "section", label: "Teaching Program", value: null, wording: null },
    ...resolveProgramItems(programItems, data.music, data.speakersAdults, data.speakersYouth).map((item) =>
      programItemRow(item, peopleById)
    ),
    ...buildConductingRows({ elements: closingElements, ...rowInputs }),
  ];

  return {
    meetingTitle: meeting.title,
    meetingDate: meeting.date,
    specialFormat: data.planning?.special_format ?? "standard",
    rows,
  };
}
