import type { TemplateElementRow, RoleAssignmentValue } from "@/lib/data/meeting-elements";
import type { ElementNoteValue } from "@/lib/data/meeting-element-notes";
import type { MusicRow, PlanningInfo, RabnmRow } from "@/lib/data/sacrament-planning";

/**
 * The Conducting view's read-only row model, built 2026-09-10 as the
 * counterpart to `buildAgendaRows` (lib/data/agenda-rows.ts) -- same
 * per-element dispatch, same four sections (Opening, Administration of
 * the Sacrament, Teaching Program, Closing), but producing a resolved
 * display value and (only where natural) a suggested spoken line
 * instead of an editable field. This is what makes Conducting
 * "template-driven" the way Planning already is, rather than the old
 * `getConductingScript`'s hand-written fixed sequence, which ignored
 * per-meeting agenda customization entirely.
 *
 * Per the user's own answers when this was scoped: value-only for
 * Presiding/Conducting/Speaker names (nothing natural to "say" beyond
 * knowing who they are); value + a suggested line for hymns, prayers,
 * Recognize Music, RABNM, Stake Business, Sacrament Administered,
 * Musical Numbers/Intermediate Hymn/Testimony.
 *
 * Each row's wording is deliberately self-contained -- the old
 * hand-written script had a couple of sentences spanning two elements
 * ("...after which the prayer will be offered by X"); a generic
 * per-element dispatch can't know what the *next* row will be, so each
 * one now states its own action standalone.
 */
export interface ConductingRow {
  id: string;
  kind: "section" | "banner" | "field";
  label: string;
  value: string | null;
  wording: string | null;
}

export interface ConductingRowInputs {
  elements: TemplateElementRow[];
  roleAssignments: Record<string, RoleAssignmentValue>;
  elementNotes: Record<string, ElementNoteValue>;
  planning: PlanningInfo | null;
  music: MusicRow[];
  rabnm: RabnmRow[];
  peopleById: Map<string, string>;
}

const SINGLETON_MUSIC_TYPES = ["opening_hymn", "sacrament_hymn", "closing_hymn"];

/** "(name not entered)" everywhere a value is genuinely blank, rather
 *  than an empty string that would render as a blank line -- a
 *  conductor mid-meeting needs to see that something's missing, not a
 *  silent gap. */
const BLANK = "(not entered)";

function hymnValue(item: MusicRow | undefined): string {
  if (!item) return BLANK;
  return `${item.hymn_number ?? "?"} ${item.piece_name ?? "(title not entered)"}`.trim();
}

export function rabnmPrompt(item: RabnmRow): string {
  const names = item.people.length > 0 ? item.people.join(", ") : "(name not entered)";
  const calling = item.calling_name ?? "(calling not entered)";

  switch (item.type) {
    case "release":
      return `${names} have been released as ${calling}, and we propose that they be given a vote of thanks for their service. Those who wish to express their appreciation may show it by the uplifted hand. (Pause) Thank you.`;
    case "new_calling":
      return `${names} have been called as ${calling}, and we propose that they be sustained. Those in favor may show it by the uplifted hand. (Pause) Those opposed, if any, may show it. (Pause) Thank you.`;
    case "presidency_change":
      return item.detail ?? `A change has been made in the ${calling} presidency.`;
    case "baby_born":
      return (
        item.detail ??
        `We want to congratulate the family on their new baby${item.event_date ? ` born ${item.event_date}` : ""}.`
      );
    case "mission_call":
      return `We want to congratulate ${names} on receiving a mission call${item.detail ? ` to serve in ${item.detail}` : ""}${item.event_date ? `, beginning missionary training on ${item.event_date}` : ""}.`;
    case "aaronic_priesthood":
      return (
        item.detail ??
        `${names} will be ordained to the Aaronic Priesthood. They have been interviewed and found worthy, and we propose that they be sustained. Those in favor may show it by the uplifted hand. (Pause) Those opposed, if any, may show it. (Pause) Thank you.`
      );
    case "baptism":
      return `${names} were recently baptized, received the Holy Ghost, and were confirmed members of the Church. Please take a moment to congratulate them.`;
    case "new_record":
      return `We have received records for new ward member(s): ${names}. Please welcome them by raising your hand. (Pause) Thank you.`;
    case "baby_blessing":
      return `${names} will be blessed today${item.detail ? ` by ${item.detail}` : ""}.`;
    default:
      return item.detail ?? "";
  }
}

export function buildConductingRows({
  elements,
  roleAssignments,
  elementNotes,
  planning,
  music,
  rabnm,
  peopleById,
}: ConductingRowInputs): ConductingRow[] {
  const rows: ConductingRow[] = [];

  const musicByType = new Map<string, MusicRow[]>();
  for (const item of music) {
    musicByType.set(item.type, [...(musicByType.get(item.type) ?? []), item]);
  }

  const personName = (id: string | null | undefined): string => (id ? peopleById.get(id) ?? BLANK : BLANK);
  const roleAssignedId = (role: string): string | null => roleAssignments[role]?.assigned_to_id ?? null;

  for (const el of elements) {
    const key = el.key;

    if (key === "ward_business") {
      rows.push({ id: el.id, kind: "banner", label: el.label, value: null, wording: null });
      for (const item of rabnm) {
        rows.push({ id: `rabnm-${item.id}`, kind: "field", label: item.type.replace(/_/g, " "), value: null, wording: rabnmPrompt(item) });
      }
      continue;
    }

    if (key === "stake_business") {
      if (!planning?.has_stake_business) continue;
      const announcer = planning.stake_business || BLANK;
      rows.push({
        id: el.id,
        kind: "field",
        label: el.label,
        value: announcer,
        wording: `${announcer} will present stake business.`,
      });
      continue;
    }

    if (key === "recognize_music") {
      const chorister = personName(roleAssignedId("chorister"));
      const organist = personName(roleAssignedId("organist"));
      rows.push({
        id: el.id,
        kind: "field",
        label: el.label,
        value: `${chorister} (Chorister), ${organist} (Organist)`,
        wording: `We would like to thank ${chorister} for conducting our music today, and ${organist} as our organist.`,
      });
      continue;
    }

    if (key === "sacrament_hymn") {
      rows.push({ id: `${el.id}-section`, kind: "section", label: "Administration of the Sacrament", value: null, wording: null });
      const item = (musicByType.get(key) ?? [])[0];
      rows.push({
        id: el.id,
        kind: "field",
        label: el.label,
        value: hymnValue(item),
        wording: item
          ? `We will now prepare for the administration of the sacrament by singing hymn number ${item.hymn_number ?? "?"}, ${item.piece_name ?? "(title not entered)"}.`
          : null,
      });
      continue;
    }

    if (key === "sacrament_administered") {
      rows.push({
        id: el.id,
        kind: "banner",
        label: el.label,
        value: null,
        wording: "Thank you for your reverence during the administration of the sacrament. Thank you to the priesthood holders who administered the sacrament to us.",
      });
      continue;
    }

    if (key === "closing_hymn") {
      rows.push({ id: `${el.id}-section`, kind: "section", label: "Closing", value: null, wording: null });
    }

    switch (el.resolution_kind) {
      case "person_role": {
        const name = personName(roleAssignedId(key));
        const wording =
          key === "opening_prayer"
            ? `${name} will offer our opening prayer.`
            : key === "closing_prayer"
              ? `${name} will offer our closing prayer.`
              : null; // presiding/conducting/anything else: value only
        rows.push({ id: el.id, kind: "field", label: el.label, value: name, wording });
        break;
      }

      case "free_text": {
        const text = elementNotes[key]?.text_value ?? null;
        rows.push({ id: el.id, kind: "field", label: el.label, value: text || BLANK, wording: null });
        break;
      }

      case "person_and_text": {
        const note = elementNotes[key];
        const name = note?.person_id ? personName(note.person_id) : null;
        const value = [name, note?.text_value].filter(Boolean).join(" — ") || BLANK;
        rows.push({ id: el.id, kind: "field", label: el.label, value, wording: null });
        break;
      }

      case "music": {
        const item = (musicByType.get(key) ?? [])[0];
        const isSingleton = SINGLETON_MUSIC_TYPES.includes(key);
        const wording =
          isSingleton && item
            ? `We will ${key === "opening_hymn" ? "open" : "close"} our meeting by singing hymn number ${item.hymn_number ?? "?"}, ${item.piece_name ?? "(title not entered)"}.`
            : null;
        rows.push({ id: el.id, kind: "field", label: el.label, value: hymnValue(item), wording });
        break;
      }

      case "person_slot":
        // No current Sacrament Meeting template lists a person_slot
        // element (Speakers/Youth Speakers moved to Teaching Program's
        // own freely-ordered list, see getConductingRows) -- nothing to
        // render here, kept only so an unexpected template doesn't
        // silently break the loop.
        break;

      case "none":
      default:
        rows.push({ id: el.id, kind: "banner", label: el.label, value: null, wording: null });
        break;
    }

    // Recognize Authorities (2026-09-10): not a real template element --
    // `sacrament_planning.recognitions` has never had one -- so it's
    // injected right after Conducting, matching where the original
    // hand-written script always placed it.
    if (key === "conducting" && planning?.recognitions) {
      rows.push({
        id: "recognitions",
        kind: "field",
        label: "Recognize Authorities",
        value: planning.recognitions,
        wording: `We would like to recognize ${planning.recognitions} who is/are here with us today.`,
      });
    }
  }

  return rows;
}
