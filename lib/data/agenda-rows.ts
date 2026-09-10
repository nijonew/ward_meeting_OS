import type { TemplateElementRow } from "@/lib/data/meeting-elements";
import type { RoleAssignmentValue } from "@/lib/data/meeting-elements";
import type { ElementNoteValue } from "@/lib/data/meeting-element-notes";
import type { MusicRow, SpeakerRow, PlanningInfo } from "@/lib/data/sacrament-planning";
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
 * These row shapes are deliberately plain serializable data: the page
 * (a Server Component) resolves every element against its real storage
 * table here, and AgendaGridForm (a Client Component) just renders
 * inputs from it. Each row carries the exact form field name(s)
 * saveAgendaGrid will parse back out, so the encoding lives in one
 * place rather than being duplicated across renderer and action.
 */
export type AgendaRow =
  /** A script cue with nothing to enter -- "Sacrament Administered",
   *  "Recognize Music", etc. (resolution_kind 'none'). */
  | { kind: "banner"; id: string; label: string; note?: string }
  /** One person picker -- presiding, conducting, prayers, chorister. */
  | { kind: "person"; id: string; label: string; field: string; value: string }
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
    };

/** Music types that only ever have one per meeting -- rendered as a
 *  single row with no slot, matching how MusicArrangeSection always
 *  treated them ("only one of each fits in a meeting"). */
const SINGLETON_MUSIC_TYPES = ["opening_hymn", "sacrament_hymn", "closing_hymn"];
/** Everything else in MUSIC_TYPES can repeat, and each occurrence needs
 *  its own slot so the program knows where it's called. Slots are
 *  assigned positionally (`intermediate_hymn_1`, `_2`, ...) rather than
 *  picked by hand -- the row's position in the agenda already says
 *  where it goes, which is what the old per-item "Slot" dropdown was
 *  for. */
const MAX_MUSIC_SLOTS: Record<string, number> = { intermediate_hymn: 3, musical_number: 6 };

/** `sacrament_planning` columns that are edited as agenda rows rather
 *  than through the Meeting Info form -- these are real columns on that
 *  table, not meeting_element_notes rows, so they need their own field
 *  prefix. Ward/Stake Business used to render here as a
 *  "Edit in Meeting Info above" pointer instead of an actual field. */
const PLANNING_TEXT_COLUMNS = new Set(["ward_business", "stake_business", "recognitions"]);

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
}: AgendaRowInputs): AgendaRow[] {
  const rows: AgendaRow[] = [];

  const musicByType = new Map<string, MusicRow[]>();
  for (const item of music) {
    musicByType.set(item.type, [...(musicByType.get(item.type) ?? []), item]);
  }

  const speakerBySlot = new Map<string, SpeakerRow>();
  for (const s of [...speakersAdults, ...speakersYouth]) speakerBySlot.set(s.slot, s);

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

    switch (el.resolution_kind) {
      case "person_role":
        rows.push({
          kind: "person",
          id: el.id,
          label: el.label,
          field: `role${FIELD_SEPARATOR}${key}`,
          value: roleAssignments[key]?.assigned_to_id ?? "",
        });
        break;

      case "free_text":
        if (isSacrament && PLANNING_TEXT_COLUMNS.has(key)) {
          const planningValue = (planning?.[key as keyof PlanningInfo] as string | null) ?? "";
          rows.push({
            kind: "text",
            id: el.id,
            label: el.label,
            field: `planning${FIELD_SEPARATOR}${key}`,
            value: planningValue,
          });
        } else {
          rows.push({
            kind: "text",
            id: el.id,
            label: el.label,
            field: `note${FIELD_SEPARATOR}${key}${FIELD_SEPARATOR}text`,
            value: elementNotes[key]?.text_value ?? "",
          });
        }
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
