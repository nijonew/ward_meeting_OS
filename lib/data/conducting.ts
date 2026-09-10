import { getMeetingById } from "@/lib/data/meetings";
import { getMeetingWithType, getTemplateElements, getPlannedElements, getRoleAssignments } from "@/lib/data/meeting-elements";
import { getElementNotes } from "@/lib/data/meeting-element-notes";
import { getSacramentPlanningData } from "@/lib/data/sacrament-planning";
import { getActivePeople } from "@/lib/data/people";
import { getSacramentProgramItems, resolveProgramItems, type ResolvedProgramItem } from "@/lib/data/sacrament-program";
import { buildConductingRows, type ConductingRow } from "@/lib/data/conducting-rows";

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
 *  this redesign); Musical Number/Intermediate Hymn/Testimony get a
 *  suggested line too. */
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
    default:
      return {
        id: item.id,
        kind: "banner",
        label: "Testimonies",
        value: null,
        wording: "We now invite members of the ward to bear their testimonies.",
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

  const [plannedElements, roleAssignments, elementNotes, data, people, programItems] = await Promise.all([
    getPlannedElements(meetingId),
    getRoleAssignments(meetingId, "sacrament_assignments"),
    getElementNotes(meetingId),
    getSacramentPlanningData(meetingId),
    getActivePeople(),
    getSacramentProgramItems(meetingId),
  ]);

  const templateElements =
    plannedElements.length > 0
      ? plannedElements
      : await getTemplateElements(meetingWithType.meetingTypeId, data.planning?.special_format ?? "standard");

  const peopleById = new Map(people.map((p) => [p.id, p.name]));

  // Split at Closing Hymn/Prayer, the exact same boundary
  // app/meetings/[id]/planning/page.tsx uses for the editable grid --
  // duplicated rather than shared, since it's ~3 lines and the two
  // call sites are a Server Component and a data module.
  const elementsForGrid = templateElements.filter((el) => el.key !== "agenda_items");
  const closingIndex = elementsForGrid.findIndex((el) => el.key === "closing_hymn" || el.key === "closing_prayer");
  const openingElements = closingIndex !== -1 ? elementsForGrid.slice(0, closingIndex) : elementsForGrid;
  const closingElements = closingIndex !== -1 ? elementsForGrid.slice(closingIndex) : [];

  const rowInputs = {
    roleAssignments,
    elementNotes,
    planning: data.planning,
    music: data.music,
    rabnm: data.rabnm,
    peopleById,
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
