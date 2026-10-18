import type { TemplateElementRow, RoleAssignmentValue } from "@/lib/data/meeting-elements";
import type { ElementNoteValue } from "@/lib/data/meeting-element-notes";
import type { MusicRow, PlanningInfo, RabnmRow } from "@/lib/data/sacrament-planning";
import type { VisitingAuthorityRow } from "@/lib/data/visiting-authorities";
import type { PulledAnnouncement } from "@/lib/data/sacrament-announcements";
import { formatAnnouncementSchedule } from "@/lib/data/announcements";

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
  visitingAuthorities: VisitingAuthorityRow[];
  /** Grouped by which specific Announcements block (`meeting_planned_elements`
   *  row id) each pulled announcement belongs to -- a meeting can have
   *  more than one (migration 074, 2026-10-11). See
   *  lib/data/agenda-rows.ts's own `announcementsByPlannedElement` for
   *  the matching Planning-side comment. */
  announcementsByPlannedElement: Map<string, PulledAnnouncement[]>;
  peopleById: Map<string, string>;
}

/** The spoken line for one announcement -- the core text, plus
 *  date/time and location if either is filled in. Deliberately leaves
 *  out `link_url` -- not something to read aloud at the pulpit.
 *
 *  **Date/time formatting, 2026-10-18** (the user's own request: "make
 *  that change in the conducting view and where they are viewed") --
 *  reads "Monday, October 19th at 6:00 PM." instead of the raw
 *  `start_date`/`start_time` strings Postgres returns ("2026-10-19",
 *  "18:00:00"), matching the same format the public Announcements
 *  page now uses. Still only ever reads `start_date`/`start_time`
 *  aloud, not `end_date`/`end_time` -- that scope is unchanged, just
 *  the format.
 *
 *  **Location moved after date/time, same day** (the user's own
 *  immediate follow-up: "move the location in an announcement to be
 *  after the time and date") -- both now read as one combined
 *  sentence via the shared `formatAnnouncementSchedule`
 *  (`lib/data/announcements.ts`), e.g. "Monday, October 19th at 6:00
 *  PM - Stake Center.", replacing the separate "Location: X."/"Date:
 *  Y." sentences (location used to come first). */
export function announcementWording(a: PulledAnnouncement): string {
  const parts = [a.body];
  const schedule = formatAnnouncementSchedule(a);
  if (schedule) parts.push(`${schedule}.`);
  return parts.filter(Boolean).join(" ");
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
  visitingAuthorities,
  announcementsByPlannedElement,
  peopleById,
}: ConductingRowInputs): ConductingRow[] {
  const rows: ConductingRow[] = [];

  const musicByType = new Map<string, MusicRow[]>();
  for (const item of music) {
    musicByType.set(item.type, [...(musicByType.get(item.type) ?? []), item]);
  }

  // Releases first, then new callings (the user's own request,
  // 2026-10-15: "order callings and releases to announce all releases
  // first and then all new callings after that"). sacrament_rabnm has
  // no ordering column of its own and this fetch has no `.order()`
  // (lib/data/sacrament-planning.ts), so without this the Conducting
  // script would read back in whatever order Postgres happens to
  // return rows, not a deliberate one. Any other legacy type (a
  // pre-2026-10-03 "Other" item -- baby blessing, baptism, mission
  // call, etc., still fetched here even though Planning's own
  // WardBusinessField no longer manages them) sorts after both,
  // keeping its own relative order via Array.prototype.sort's
  // stability rather than being silently dropped or reshuffled.
  const RABNM_ORDER_WEIGHT: Record<string, number> = { release: 0, new_calling: 1 };
  const orderedRabnm = [...rabnm].sort(
    (a, b) => (RABNM_ORDER_WEIGHT[a.type] ?? 2) - (RABNM_ORDER_WEIGHT[b.type] ?? 2)
  );

  const personName = (id: string | null | undefined): string => (id ? peopleById.get(id) ?? BLANK : BLANK);
  const roleAssignedId = (role: string): string | null => roleAssignments[role]?.assigned_to_id ?? null;
  // Falls back to the role's guest name (Chorister/Organist's guest
  // option, migration 064, 2026-10-07) when no real person is assigned.
  const roleDisplayName = (role: string): string => {
    const entry = roleAssignments[role];
    if (entry?.assigned_to_id) return personName(entry.assigned_to_id);
    if (entry?.guest_name) return entry.guest_name;
    return BLANK;
  };

  for (const el of elements) {
    const key = el.key;

    if (key === "ward_business") {
      rows.push({ id: el.id, kind: "banner", label: el.label, value: null, wording: null });
      for (const item of orderedRabnm) {
        rows.push({ id: `rabnm-${item.id}`, kind: "field", label: item.type.replace(/_/g, " "), value: null, wording: rabnmPrompt(item) });
      }
      continue;
    }

    // Announcements (2026-10-11) -- one field row per pulled
    // announcement, same "banner for the section, one field per item"
    // shape as Ward Business/RABNM above. Skipped entirely when none
    // are pulled in, same as Visiting Authorities below -- nothing to
    // say if nothing's been selected.
    if (key === "announcements") {
      const announcements = announcementsByPlannedElement.get(el.id) ?? [];
      if (announcements.length === 0) continue;
      rows.push({ id: el.id, kind: "banner", label: el.label, value: null, wording: null });
      for (const item of announcements) {
        rows.push({ id: `announcement-${item.id}`, kind: "field", label: item.title, value: item.title, wording: announcementWording(item) });
      }
      continue;
    }

    // Visiting Authorities (2026-10-03, migration 053) -- read-only
    // list of names from sacrament_visiting_authorities, skipped
    // entirely when none are recognized rather than showing an empty
    // line (nothing to say if nobody's being welcomed).
    if (key === "visiting_authorities") {
      if (visitingAuthorities.length === 0) continue;
      const names = visitingAuthorities.map((v) => v.displayName || BLANK).join(", ");
      rows.push({
        id: el.id,
        kind: "field",
        label: el.label,
        value: names,
        wording: `We are pleased to welcome ${names} with us today.`,
      });
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
      const chorister = roleDisplayName("chorister");
      const organist = roleDisplayName("organist");
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
