import type { TemplateElementRow } from "@/lib/data/meeting-elements";
import type { RoleAssignmentValue } from "@/lib/data/meeting-elements";
import type { ElementNoteValue } from "@/lib/data/meeting-element-notes";
import type { MusicRow, SpeakerRow, PlanningInfo } from "@/lib/data/sacrament-planning";
import type { PersonOption } from "@/lib/data/people";
import { slotLabel } from "@/lib/data/sacrament-constants";

/**
 * The planning view's agenda grid, built 2026-09-09 from the user's own
 * real spreadsheet agenda: "I want them to also be more agenda-like.
 * single line for each element with a field that can be edited after
 * being pre-filled." One row per agenda element, in the meeting's own
 * element order, label on the left and its editable value on the right
 * -- replacing the old stack of one-bordered-box-per-element, each with
 * its own Save button, plus separate Music/Speakers sections tacked on
 * below out of agenda order.
 *
 * Reworked the same day, line by line, from the user's own notes
 * against a real agenda screenshot -- see each row kind's own comment
 * below for what changed and why. Ward Business and Speakers & Music
 * moved to their own pages entirely (/meetings/[id]/ward-business,
 * /meetings/[id]/speakers-music), since their own add/remove controls
 * can't be real <form>s nested inside this grid's single big <form>
 * (HTML forbids nested forms) -- both render as a banner-with-link row
 * right here instead of a real field. Ward Business is a real
 * (untouched) catalog element still in the meeting's own element list;
 * Speakers & Music has no catalog element to key off anymore (its old
 * fixed elements -- Speaker/Youth Speaker/Intermediate Hymn -- were
 * removed from the templates entirely, migration 046), so the page
 * splices a synthetic "speakers_music_link" marker into `elements`
 * wherever it belongs (right before Closing Hymn) before calling this
 * function.
 *
 * These row shapes are deliberately plain serializable data: the page
 * (a Server Component) resolves every element against its real storage
 * table here, and AgendaGridForm (a Client Component) just renders
 * inputs from it. Each row carries the exact form field name(s)
 * saveAgendaGrid will parse back out, so the encoding lives in one
 * place rather than being duplicated across renderer and action.
 */
export type AgendaRow =
  /** A script cue with nothing to enter -- "Recognize Music" (before it
   *  grew fields, see below), "Sacrament Administered", etc.
   *  (resolution_kind 'none'). */
  | { kind: "banner"; id: string; label: string; note?: string; href?: string }
  /** A bold section divider with no data of its own -- e.g.
   *  "Administration of the Sacrament", grouping the rows under it. */
  | { kind: "section"; id: string; label: string }
  /** One person picker -- presiding, conducting, prayers. `eligiblePeople`
   *  is the calling-restricted list for this specific element (2026-09-09,
   *  the user's own words: "all dropdowns should follow the rules for the
   *  field by calling rather than have all people in the dropdown") --
   *  already resolved by the page (falls back to every active person when
   *  no calling-based rule is configured for this element at all). */
  | { kind: "person"; id: string; label: string; field: string; value: string; eligiblePeople: PersonOption[] }
  /** One line of free text. */
  | { kind: "text"; id: string; label: string; field: string; value: string; placeholder?: string }
  /** A person plus a line of text (spiritual thought, handbook training). */
  | {
      kind: "person_text";
      id: string;
      label: string;
      personField: string;
      textField: string;
      personValue: string;
      textValue: string;
    }
  /** Hymn number + title (+ performer, for musical numbers). */
  | {
      kind: "music";
      id: string;
      label: string;
      numberField: string;
      titleField: string;
      performerField: string;
      numberValue: string;
      titleValue: string;
      performerValue: string;
      showPerformer: boolean;
    }
  /** Speaker slot: a person (or a guest name) plus a topic. */
  | {
      kind: "speaker";
      id: string;
      label: string;
      personField: string;
      guestField: string;
      topicField: string;
      personValue: string;
      guestValue: string;
      topicValue: string;
    }
  /** Recognize Music: Chorister + Organist, together on one line
   *  (2026-09-09, the user's own request: "remove organist and
   *  chorister as their own lines, but put both in-line on the
   *  recognize music line"). Still writes straight to
   *  sacrament_assignments via the same "role::<key>" field encoding
   *  every other person_role row uses -- only the *rendering* groups
   *  them, storage is unchanged. */
  | {
      kind: "recognize_music";
      id: string;
      label: string;
      choristerField: string;
      organistField: string;
      choristerValue: string;
      organistValue: string;
      choristerEligible: PersonOption[];
      organistEligible: PersonOption[];
    }
  /** Stake Business: a yes/no toggle, and (only if yes) a short answer
   *  for who's announcing it (2026-09-09, the user's own request --
   *  replaces what used to be free text describing the business
   *  itself). */
  | {
      kind: "stake_business";
      id: string;
      label: string;
      toggleField: string;
      announcerField: string;
      hasStakeBusiness: boolean;
      announcerValue: string;
    };

/** Music types that only ever have one per meeting -- rendered as a
 *  single row with no slot. */
const SINGLETON_MUSIC_TYPES = ["opening_hymn", "sacrament_hymn", "closing_hymn"];
/** Kept for any repeatable `music`/`person_slot` element a template
 *  might still list -- Sacrament Meeting's own templates no longer
 *  include any (migration 046: Speakers/Youth Speakers/Intermediate
 *  Hymn/Musical Numbers moved to their own freely add/remove list, see
 *  lib/data/sacrament-program.ts), but this stays as a safe fallback
 *  rather than assuming no other template will ever use one. */
const MAX_MUSIC_SLOTS: Record<string, number> = { intermediate_hymn: 3, musical_number: 6 };

export const FIELD_SEPARATOR = "::";

export interface AgendaRowInputs {
  elements: TemplateElementRow[];
  roleAssignments: Record<string, RoleAssignmentValue>;
  elementNotes: Record<string, ElementNoteValue>;
  isSacrament: boolean;
  planning: PlanningInfo | null;
  music: MusicRow[];
  speakersAdults: SpeakerRow[];
  speakersYouth: SpeakerRow[];
  /** Calling-restricted eligible-people list per person_role element key
   *  -- null means no calling-based rule is configured, fall back to
   *  `allPeople`. See getEligiblePeopleByElementKey (lib/data/rotations.ts). */
  eligibilityByKey: Record<string, PersonOption[] | null>;
  allPeople: PersonOption[];
  /** Presiding defaults to whoever holds the Bishop calling when no
   *  sacrament_assignments row exists yet for it (2026-09-09: "Default
   *  presiding to the bishop"). Null when the Bishop calling itself is
   *  vacant -- the row is simply left blank, same as any other
   *  unassigned role. */
  defaultPresidingId: string | null;
  /** For building the Ward Business / Speakers & Music banner rows'
   *  links to their own pages. */
  meetingId: string;
}

/** How many rows a repeatable element gets: what the meeting's own
 *  template asks for, but never fewer than what's already been entered
 *  -- lowering slot_count later must not orphan (or silently hide) a
 *  speaker/hymn someone already filled in. Plus one spare when there's
 *  room, so another can be added without editing the template first. */
function slotRowCount(requested: number | null, used: number, max: number): number {
  return Math.min(Math.max(requested ?? 1, used) + (used >= (requested ?? 1) ? 1 : 0), max);
}

export function buildAgendaRows({
  elements,
  roleAssignments,
  elementNotes,
  isSacrament,
  planning,
  music,
  speakersAdults,
  speakersYouth,
  eligibilityByKey,
  allPeople,
  defaultPresidingId,
  meetingId,
}: AgendaRowInputs): AgendaRow[] {
  const rows: AgendaRow[] = [];

  const musicByType = new Map<string, MusicRow[]>();
  for (const item of music) {
    musicByType.set(item.type, [...(musicByType.get(item.type) ?? []), item]);
  }

  const speakerBySlot = new Map<string, SpeakerRow>();
  for (const s of [...speakersAdults, ...speakersYouth]) speakerBySlot.set(s.slot, s);

  const eligibleFor = (key: string): PersonOption[] => eligibilityByKey[key] ?? allPeople;

  /** Highest 1-based index actually used by existing `<prefix>_N` rows. */
  const highestUsedIndex = (prefix: string, slots: Iterable<string>): number => {
    let highest = 0;
    for (const slot of slots) {
      if (!slot.startsWith(`${prefix}_`)) continue;
      const n = Number(slot.slice(prefix.length + 1));
      if (Number.isFinite(n) && n > highest) highest = n;
    }
    return highest;
  };

  for (const el of elements) {
    const key = el.key;

    // Ward Business (2026-09-09: "a fixed line without any field" --
    // the actual releases/callings/baby blessings/etc. list moved to
    // its own page, /meetings/[id]/ward-business, since RabnmSection's
    // own add/remove forms can't nest inside this grid's <form>).
    if (isSacrament && key === "ward_business") {
      rows.push({ kind: "banner", id: el.id, label: el.label, href: `/meetings/${meetingId}/ward-business` });
      continue;
    }

    // Speakers & Music (2026-09-09: a freely add/remove/reorderable
    // list on its own page, /meetings/[id]/speakers-music -- see
    // lib/data/sacrament-program.ts). No real catalog element to key
    // off anymore (its old fixed elements were removed from the
    // templates entirely, migration 046) -- the page splices this
    // synthetic "speakers_music_link" marker into `elements` wherever
    // it belongs before calling this function.
    if (isSacrament && key === "speakers_music_link") {
      rows.push({ kind: "banner", id: el.id, label: el.label, href: `/meetings/${meetingId}/speakers-music` });
      continue;
    }

    // Stake Business (2026-09-09: yes/no toggle + optional announcer,
    // replacing free text) -- checked before the generic switch since
    // it's still catalogued as resolution_kind 'free_text' but no
    // longer rendered as one.
    if (isSacrament && key === "stake_business") {
      rows.push({
        kind: "stake_business",
        id: el.id,
        label: el.label,
        toggleField: `planning${FIELD_SEPARATOR}has_stake_business`,
        announcerField: `planning${FIELD_SEPARATOR}stake_business`,
        hasStakeBusiness: planning?.has_stake_business ?? false,
        announcerValue: planning?.stake_business ?? "",
      });
      continue;
    }

    // Recognize Music (2026-09-09: Chorister + Organist inline, no
    // longer their own lines) -- checked before the switch since it's
    // catalogued as resolution_kind 'none' but now carries two real
    // fields.
    if (isSacrament && key === "recognize_music") {
      rows.push({
        kind: "recognize_music",
        id: el.id,
        label: el.label,
        choristerField: `role${FIELD_SEPARATOR}chorister`,
        organistField: `role${FIELD_SEPARATOR}organist`,
        choristerValue: roleAssignments["chorister"]?.assigned_to_id ?? "",
        organistValue: roleAssignments["organist"]?.assigned_to_id ?? "",
        choristerEligible: eligibleFor("chorister"),
        organistEligible: eligibleFor("organist"),
      });
      continue;
    }

    // Administration of the Sacrament (2026-09-09: a section heading
    // grouping Sacrament Hymn with the new "Sacrament Administered" cue
    // right after it, migration 046) -- the heading itself isn't a real
    // catalog element, just a divider synthesized here whenever the
    // Sacrament Hymn is about to render.
    if (isSacrament && key === "sacrament_hymn") {
      rows.push({ kind: "section", id: `${el.id}-section`, label: "Administration of the Sacrament" });
    }

    switch (el.resolution_kind) {
      case "person_role":
        rows.push({
          kind: "person",
          id: el.id,
          label: el.label,
          field: `role${FIELD_SEPARATOR}${key}`,
          value: roleAssignments[key]?.assigned_to_id ?? (key === "presiding" ? defaultPresidingId ?? "" : ""),
          eligiblePeople: eligibleFor(key),
        });
        break;

      case "free_text":
        rows.push({
          kind: "text",
          id: el.id,
          label: el.label,
          field: `note${FIELD_SEPARATOR}${key}${FIELD_SEPARATOR}text`,
          value: elementNotes[key]?.text_value ?? "",
        });
        break;

      case "person_and_text":
        rows.push({
          kind: "person_text",
          id: el.id,
          label: el.label,
          personField: `note${FIELD_SEPARATOR}${key}${FIELD_SEPARATOR}person`,
          textField: `note${FIELD_SEPARATOR}${key}${FIELD_SEPARATOR}text`,
          personValue: elementNotes[key]?.person_id ?? "",
          textValue: elementNotes[key]?.text_value ?? "",
        });
        break;

      case "music": {
        const existing = musicByType.get(key) ?? [];

        if (SINGLETON_MUSIC_TYPES.includes(key)) {
          const item = existing[0];
          rows.push({
            kind: "music",
            id: el.id,
            label: el.label,
            numberField: `music${FIELD_SEPARATOR}${key}${FIELD_SEPARATOR}-${FIELD_SEPARATOR}number`,
            titleField: `music${FIELD_SEPARATOR}${key}${FIELD_SEPARATOR}-${FIELD_SEPARATOR}title`,
            performerField: `music${FIELD_SEPARATOR}${key}${FIELD_SEPARATOR}-${FIELD_SEPARATOR}performer`,
            numberValue: item?.hymn_number != null ? String(item.hymn_number) : "",
            titleValue: item?.piece_name ?? "",
            performerValue: item?.group_name ?? item?.individual_name ?? "",
            showPerformer: false,
          });
          break;
        }

        // Fallback path -- no current Sacrament Meeting template lists a
        // repeatable music element anymore (see the file comment above).
        const max = MAX_MUSIC_SLOTS[key] ?? 1;
        const used = highestUsedIndex(
          key,
          existing.map((m) => m.slot ?? "")
        );
        const count = slotRowCount(el.slot_count, used, max);
        for (let i = 1; i <= count; i++) {
          const slot = `${key}_${i}`;
          const item = existing.find((m) => m.slot === slot);
          rows.push({
            kind: "music",
            id: `${el.id}-${slot}`,
            label: count > 1 ? slotLabel(slot) : el.label,
            numberField: `music${FIELD_SEPARATOR}${key}${FIELD_SEPARATOR}${slot}${FIELD_SEPARATOR}number`,
            titleField: `music${FIELD_SEPARATOR}${key}${FIELD_SEPARATOR}${slot}${FIELD_SEPARATOR}title`,
            performerField: `music${FIELD_SEPARATOR}${key}${FIELD_SEPARATOR}${slot}${FIELD_SEPARATOR}performer`,
            numberValue: item?.hymn_number != null ? String(item.hymn_number) : "",
            titleValue: item?.piece_name ?? "",
            performerValue: item?.group_name ?? item?.individual_name ?? "",
            showPerformer: key === "musical_number",
          });
        }
        break;
      }

      case "person_slot": {
        // Fallback path -- see the "music" case's own comment above;
        // Sacrament Meeting no longer templates person_slot elements
        // either.
        const variant = key === "youth_speaker" ? "youth" : "adults";
        const pool = variant === "youth" ? speakersYouth : speakersAdults;
        const used = highestUsedIndex(
          key,
          pool.map((s) => s.slot)
        );
        const count = slotRowCount(el.slot_count, used, 9);
        for (let i = 1; i <= count; i++) {
          const slot = `${key}_${i}`;
          const existing = speakerBySlot.get(slot);
          rows.push({
            kind: "speaker",
            id: `${el.id}-${slot}`,
            label: slotLabel(slot),
            personField: `speaker${FIELD_SEPARATOR}${variant}${FIELD_SEPARATOR}${slot}${FIELD_SEPARATOR}person`,
            guestField: `speaker${FIELD_SEPARATOR}${variant}${FIELD_SEPARATOR}${slot}${FIELD_SEPARATOR}guest`,
            topicField: `speaker${FIELD_SEPARATOR}${variant}${FIELD_SEPARATOR}${slot}${FIELD_SEPARATOR}topic`,
            personValue: existing?.speaker_id ?? "",
            guestValue: existing?.guest_speaker_name ?? "",
            topicValue: existing?.topic ?? "",
          });
        }
        break;
      }

      case "none":
      default:
        rows.push({ kind: "banner", id: el.id, label: el.label });
        break;
    }
  }

  return rows;
}
