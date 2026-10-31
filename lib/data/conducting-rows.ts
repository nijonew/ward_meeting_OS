import type { TemplateElementRow, RoleAssignmentValue } from "@/lib/data/meeting-elements";
import type { ElementNoteValue } from "@/lib/data/meeting-element-notes";
import type { MusicRow, PlanningInfo, RabnmRow } from "@/lib/data/sacrament-planning";
import type { VisitingAuthorityRow } from "@/lib/data/visiting-authorities";
import type { PulledAnnouncement } from "@/lib/data/sacrament-announcements";
import { formatAnnouncementScheduleLine } from "@/lib/data/announcements";
import { formatTitleLastName, formatTitleFullName } from "@/lib/data/person-display";

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
 * **Rewritten 2026-10-31** against a complete, detailed script the
 * user supplied (Welcome, Introductions, Announcements, Ward
 * Business, Stake Business, Baby Blessing, Closing) -- the biggest
 * change since this file was first built. Most elements are still
 * self-contained, but Ward Business's own subsections (New Members,
 * Advancements, Baptisms, Releases, Callings) are now genuinely
 * grouped (several RabnmRow items combine into ONE spoken sentence,
 * not one per row), and a few rows deliberately know about each other
 * now (Stake Business/Baby Blessing both need to know whether the
 * other one exists this meeting, to avoid saying the sacrament-
 * transition sentence twice) -- see each section's own comment below
 * for exactly what and why.
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
  /** "<elementKey>::<personId>" -> that calling's title_prefix, for
   *  whichever pairs actually resolve via a calling (2026-10-21 --
   *  see getTitlePrefixesForAssignments, lib/data/person-display.ts).
   *  A pair with no entry here always falls back to the plain name.
   *  Also covers "visiting_authorities"::<personId> pairs as of
   *  2026-10-31. */
  titlePrefixByKey: Map<string, string>;
  /** person id -> `people.gender` ("male"/"female"/null) -- 2026-10-31,
   *  for the handful of singular pronoun choices Ward Business's own
   *  wording now makes (New Members, Baptisms, single Callings/
   *  Releases). See pronounsFor below for the unset-gender fallback. */
  genderById: Map<string, string | null>;
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
  const schedule = formatAnnouncementScheduleLine(a);
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

/** "A and B" for two, "A, B, and C" for three or more -- the Oxford-
 *  comma join every grouped Ward Business sentence below uses for its
 *  own list of names (or "name as calling" pairs). */
function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

interface Pronouns {
  subject: string;
  object: string;
  possessive: string;
}

/** he/him/his, she/her/her, or they/them/their -- 2026-10-31. Unset or
 *  anything other than "male"/"female" (`people.gender`, migration
 *  091) falls back to "they/them/their" -- a documented default, not
 *  something the user was asked about directly, since most of this
 *  ward's existing people rows predate the gender field and will be
 *  blank for a while. */
function pronounsFor(gender: string | null | undefined): Pronouns {
  if (gender === "male") return { subject: "he", object: "him", possessive: "his" };
  if (gender === "female") return { subject: "she", object: "her", possessive: "her" };
  return { subject: "they", object: "them", possessive: "their" };
}

/** Releases/Callings/New Members/Baptisms all need "this specific
 *  person's id" to resolve a pronoun, which only a single RabnmRow's
 *  own `people` array (now `{id,name}[]`, migration 093's own
 *  companion type change) can give directly -- this just flattens a
 *  group of RabnmRow items into one combined {id,name,callingName}
 *  list, since Releases/Callings also need each person's own calling
 *  name alongside them. */
function flattenPeople(items: RabnmRow[]): { id: string; name: string; callingName: string | null }[] {
  return items.flatMap((item) => item.people.map((p) => ({ id: p.id, name: p.name, callingName: item.calling_name })));
}

/** Legacy RABNM types this script gives no specific wording for
 *  (pre-2026-10-03 manually-added items, or the current `recognition`
 *  category, which the user's own script simply doesn't mention) --
 *  unchanged from before this rewrite, one row per item. */
export function rabnmPrompt(item: RabnmRow): string {
  const names = item.people.length > 0 ? item.people.map((p) => p.name).join(", ") : "(name not entered)";
  const calling = item.calling_name ?? "(calling not entered)";

  switch (item.type) {
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
    case "new_record":
      return `We have received records for new ward member(s): ${names}. Please welcome them by raising your hand. (Pause) Thank you.`;
    default:
      return item.detail ?? "";
  }
}

/** New Members (RABNM type `new_member`) -- every such item this
 *  meeting, grouped into ONE sentence (the script's own plural
 *  phrasing implies a group, not one sentence per row). Exactly one
 *  person total -> the gendered singular template; more than one ->
 *  the plural "them/their" template, every name listed. */
function newMemberWording(items: RabnmRow[], genderById: Map<string, string | null>): string {
  const people = flattenPeople(items);
  if (people.length === 0) return "";

  if (people.length === 1) {
    const { object, possessive } = pronounsFor(genderById.get(people[0].id));
    return `We would like to recognize a new member of our ward and would like to ask ${object} to stand as we read ${possessive} name. We have received the records of ${people[0].name} and welcome ${object} to our ward. Those who wish to welcome ${object} can show it by raising their hand. Thank you.`;
  }

  const names = joinWithAnd(people.map((p) => p.name));
  return `We would like to recognize some new members of our ward and would like to ask them to stand as we read their names. We have received the records of ${names} and welcome them to our ward. Those who wish to welcome them can show it by raising their hand. Thank you.`;
}

/** Baptisms (RABNM type `baptism`) -- same grouping as New Members,
 *  one combined sentence regardless of how many baptism rows exist
 *  this meeting. */
function baptismWording(items: RabnmRow[], genderById: Map<string, string | null>): string {
  const people = flattenPeople(items);
  if (people.length === 0) return "";

  const { subject, object } = people.length === 1 ? pronounsFor(genderById.get(people[0].id)) : pronounsFor(null);
  const names = joinWithAnd(people.map((p) => p.name));
  return `We were honored to be part of the baptism of ${names}. Would ${subject} please stand? Please share your love with ${object} as you see ${object} and welcome ${object} as the newest members of our ward.`;
}

/** Releases (RABNM type `release`) -- 0 nothing, 1 the gendered
 *  singular sentence, 2-3 one combined sentence, 4+ the "following
 *  ward members" sentence, exactly matching the three tiers the
 *  user's own script gives. */
function releaseWording(items: RabnmRow[], genderById: Map<string, string | null>): string {
  const entries = flattenPeople(items);
  if (entries.length === 0) return "";

  if (entries.length === 1) {
    const { object, possessive } = pronounsFor(genderById.get(entries[0].id));
    return `We have released ${entries[0].name} as ${entries[0].callingName ?? "(calling not entered)"} and would like to thank ${object} for ${possessive} service. All those who can join me in sharing that thanks please show by the raised hand. Thank you.`;
  }

  const pairs = entries.map((e) => `${e.name} as ${e.callingName ?? "(calling not entered)"}`);
  if (entries.length <= 3) {
    return `We have released ${joinWithAnd(pairs)} and would like to thank them for their service. All those who can join me in sharing that thanks please show by the raised hand. Thank you.`;
  }
  return `The following ward members have been released from their callings: ${pairs.join(", ")}. All those who can join me in sharing gratitude with them please show by the raised hand. Thank you.`;
}

/** New Callings (RABNM type `new_calling`) -- 0 nothing, 1 the
 *  gendered singular sentence, 2+ one combined sentence. The user's
 *  own script only gave ONE multi-person template for this (unlike
 *  Releases' 2-3-vs-4+ split) -- its own "(If more than one individual
 *  is being released)" sub-heading here is read as a copy-paste of
 *  "being called" (this bullet is under "Callings," and Releases
 *  already has its own, separate multi-person handling above). */
function callingWording(items: RabnmRow[], genderById: Map<string, string | null>): string {
  const entries = flattenPeople(items);
  if (entries.length === 0) return "";

  if (entries.length === 1) {
    const { subject, object } = pronounsFor(genderById.get(entries[0].id));
    return `We have called ${entries[0].name} as ${entries[0].callingName ?? "(calling not entered)"} and we ask ${object} to stand. We propose that ${subject} be sustained. Those in favor please show by the uplifted hand. (Pause) Those opposed please show by the same sign.`;
  }

  const pairs = entries.map((e) => `${e.name} as ${e.callingName ?? "(calling not entered)"}`);
  return `We propose the following changes to callings and ask that these friends please stand. We have called ${joinWithAnd(pairs)} and propose that they be sustained. Those in favor please show by the uplifted hand. (Pause) Those opposed please show by the same sign.`;
}

const ADVANCEMENT_OFFICES = ["Deacon", "Teacher", "Priest"] as const;

/** Exact wording for one office group -- Deacon's own sentence
 *  mentions "receive the Aaronic Priesthood" (a young man's FIRST
 *  ordination into it); Teacher/Priest don't, since they're already
 *  Aaronic Priesthood holders being advanced within it -- matches the
 *  user's own script literally, not a shared template across all
 *  three offices. */
function advancementSentenceFor(office: (typeof ADVANCEMENT_OFFICES)[number], names: string[]): string {
  const list = joinWithAnd(names);
  if (office === "Deacon") {
    return `The following young men have been interviewed and have been found worthy to receive the Aaronic Priesthood and to be ordained to the office of Deacon: ${list}. Those who sustain this ordination please show by the uplifted hand. (Pause) Those opposed please show by the same sign.`;
  }
  return `The following young men have been interviewed and found worthy to be ordained to the office of ${office}: ${list}. Those who sustain this ordination please show by the uplifted hand. (Pause) Those opposed please show by the same sign.`;
}

/** Advancements (RABNM type `advancement`) -- grouped by OFFICE, not
 *  one row per item, matching the script's own plural "(insert names
 *  of those becoming Deacons)" phrasing: every Deacon-advancement this
 *  meeting shares one sentence, every Teacher-advancement another,
 *  etc. `item.detail` ("New office," migration 085) is matched
 *  case-insensitively by substring -- it's free text, not a fixed
 *  vocabulary -- and anything that matches none of the three offices
 *  falls back to a generic, office-less sentence rather than being
 *  silently dropped. Returns one ConductingRow per non-empty group. */
function advancementRows(items: RabnmRow[]): ConductingRow[] {
  const byOffice = new Map<string, { id: string; name: string }[]>();
  const unmatched: { id: string; name: string }[] = [];

  for (const item of items) {
    const detail = (item.detail ?? "").toLowerCase();
    const office = ADVANCEMENT_OFFICES.find((o) => detail.includes(o.toLowerCase()));
    const people = item.people.map((p) => ({ id: p.id, name: p.name }));
    if (office) byOffice.set(office, [...(byOffice.get(office) ?? []), ...people]);
    else unmatched.push(...people);
  }

  const rows: ConductingRow[] = [];
  for (const office of ADVANCEMENT_OFFICES) {
    const people = byOffice.get(office);
    if (!people || people.length === 0) continue;
    const names = people.map((p) => p.name);
    rows.push({
      id: `rabnm-advancement-${office}`,
      kind: "field",
      label: `Advancement (${office})`,
      value: names.join(", "),
      wording: advancementSentenceFor(office, names),
    });
  }
  if (unmatched.length > 0) {
    const names = unmatched.map((p) => p.name);
    rows.push({
      id: "rabnm-advancement-other",
      kind: "field",
      label: "Advancement",
      value: names.join(", "),
      wording: `The following have been interviewed and found worthy to be advanced: ${joinWithAnd(names)}. Those who sustain please show by the uplifted hand. (Pause) Those opposed please show by the same sign.`,
    });
  }
  return rows;
}

/** Baby Blessing (RABNM type `baby_blessing`) -- family name is the
 *  last word of `baby_name` (migration 093, carried through from the
 *  planning pool at pull time) -- falls back to the generic "the
 *  family" when blank, since this is brand-new data and older rows
 *  won't have it. More than one blessing in the same meeting (rare)
 *  joins every family name with "and." `transitionSentence` is
 *  appended by the caller, not this function -- see buildConductingRows'
 *  own hoisted `sacramentTransitionSentence` below. */
function babyBlessingWording(items: RabnmRow[]): string {
  const familyNames = items.map((item) => {
    const lastWord = (item.baby_name ?? "").trim().split(/\s+/).filter(Boolean).pop();
    return lastWord ? `${lastWord} family` : "family";
  });
  const performer = items[0]?.detail || BLANK;
  return `We are pleased to have the naming and blessing of a new baby in the ${joinWithAnd(familyNames)}. The blessing will be performed by ${performer} and would invite him to come forward along with those Melchizedek Priesthood holders who have been invited to participate in the blessing.`;
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
  titlePrefixByKey,
  genderById,
}: ConductingRowInputs): ConductingRow[] {
  const rows: ConductingRow[] = [];

  const musicByType = new Map<string, MusicRow[]>();
  for (const item of music) {
    musicByType.set(item.type, [...(musicByType.get(item.type) ?? []), item]);
  }

  // Ward Business's own fixed subsection order, for Conducting only --
  // 2026-10-31. Deliberately does NOT follow the admin-configurable
  // Ward Business subsection order (ward_settings.ward_business_section_order,
  // built the prior session) -- that setting is about Planning's own
  // editing convenience; this is a prescriptive spoken script where
  // Baby Blessing specifically has to come last (it owns the
  // sacrament-transition sentence below), so Conducting gets its own
  // fixed sequence independent of that setting.
  const rabnmByType = new Map<string, RabnmRow[]>();
  for (const item of rabnm) {
    rabnmByType.set(item.type, [...(rabnmByType.get(item.type) ?? []), item]);
  }
  const hasBabyBlessing = (rabnmByType.get("baby_blessing") ?? []).length > 0;

  // Hoisted above the element loop -- both Stake Business and Baby
  // Blessing need to know the meeting's own Sacrament Hymn (for the
  // sacrament-transition sentence), and Sacrament Hymn itself needs to
  // know whether either of them already said it, regardless of which
  // order these three elements actually appear in the real template.
  const sacramentHymnItem = (musicByType.get("sacrament_hymn") ?? [])[0];
  const sacramentTransitionSentence = sacramentHymnItem
    ? `We will now move into the sacrament portion of our meeting by singing hymn number ${sacramentHymnItem.hymn_number ?? "?"}, ${sacramentHymnItem.piece_name ?? "(title not entered)"}, and the sacrament will then be administered to us.`
    : "";
  const hasStakeBusiness = Boolean(planning?.has_stake_business);
  const transitionAlreadyAnnounced = hasStakeBusiness || hasBabyBlessing;

  // "Title + last name" (e.g. "Bishop Nielsen") instead of a plain name,
  // wherever this specific person currently holds the specific calling
  // that resolved them into this specific role (2026-10-21) --
  // titlePrefixByKey only has an entry for a pair that actually matched,
  // so anything else (a manual pick unrelated to any calling, or a role
  // that was never calling-based) falls straight through to the name.
  const personName = (id: string | null | undefined, elementKey?: string): string => {
    if (!id) return BLANK;
    const name = peopleById.get(id) ?? BLANK;
    if (!elementKey) return name;
    return formatTitleLastName(name, titlePrefixByKey.get(`${elementKey}::${id}`));
  };
  const roleAssignedId = (role: string): string | null => roleAssignments[role]?.assigned_to_id ?? null;
  // Falls back to the role's guest name (Chorister/Organist's guest
  // option, migration 064, 2026-10-07) when no real person is assigned.
  const roleDisplayName = (role: string): string => {
    const entry = roleAssignments[role];
    if (entry?.assigned_to_id) return personName(entry.assigned_to_id, role);
    if (entry?.guest_name) return entry.guest_name;
    return BLANK;
  };

  // Resolved once, independent of where "presiding"/"conducting" fall
  // in the real template's own element order -- Introductions (below)
  // needs both names together regardless.
  const presidingName = personName(roleAssignedId("presiding"), "presiding");
  const conductingName = personName(roleAssignedId("conducting"), "conducting");

  for (const el of elements) {
    const key = el.key;

    if (key === "ward_business") {
      const chorister = roleDisplayName("chorister");
      const organist = roleDisplayName("organist");
      rows.push({
        id: el.id,
        kind: "banner",
        label: el.label,
        value: null,
        wording: `We would like to thank ${organist} and ${chorister} for helping us with our music today.`,
      });

      const newMembers = rabnmByType.get("new_member") ?? [];
      if (newMembers.length > 0) {
        rows.push({
          id: "rabnm-new-members",
          kind: "field",
          label: "New Members",
          value: flattenPeople(newMembers).map((p) => p.name).join(", "),
          wording: newMemberWording(newMembers, genderById),
        });
      }

      rows.push(...advancementRows(rabnmByType.get("advancement") ?? []));

      const baptisms = rabnmByType.get("baptism") ?? [];
      if (baptisms.length > 0) {
        rows.push({
          id: "rabnm-baptisms",
          kind: "field",
          label: "Baptisms",
          value: flattenPeople(baptisms).map((p) => p.name).join(", "),
          wording: baptismWording(baptisms, genderById),
        });
      }

      const releases = rabnmByType.get("release") ?? [];
      if (releases.length > 0) {
        rows.push({
          id: "rabnm-releases",
          kind: "field",
          label: "Releases",
          value: flattenPeople(releases).map((p) => `${p.name} (${p.callingName ?? "?"})`).join(", "),
          wording: releaseWording(releases, genderById),
        });
      }

      const newCallings = rabnmByType.get("new_calling") ?? [];
      if (newCallings.length > 0) {
        rows.push({
          id: "rabnm-callings",
          kind: "field",
          label: "Callings",
          value: flattenPeople(newCallings).map((p) => `${p.name} (${p.callingName ?? "?"})`).join(", "),
          wording: callingWording(newCallings, genderById),
        });
      }

      if (hasStakeBusiness) {
        const announcer = planning?.stake_business || BLANK;
        const trailer = hasBabyBlessing ? "" : ` ${sacramentTransitionSentence}`;
        rows.push({
          id: "stake-business",
          kind: "field",
          label: "Stake Business",
          value: announcer,
          wording: `${announcer} will present stake business.${trailer}`,
        });
      }

      const babyBlessings = rabnmByType.get("baby_blessing") ?? [];
      if (babyBlessings.length > 0) {
        rows.push({
          id: "rabnm-baby-blessing",
          kind: "field",
          label: "Baby Blessing",
          value: babyBlessings.map((b) => b.baby_name ?? BLANK).join(", "),
          wording: `${babyBlessingWording(babyBlessings)} ${sacramentTransitionSentence}`,
        });
      }

      // Legacy types the user's own script doesn't mention
      // (presidency_change, baby_born, mission_call, aaronic_priesthood,
      // new_record -- all pre-2026-10-03, see rabnmPrompt's own
      // comment) plus the current `recognition` category, which also
      // has no specific wording given -- still one row per item, via
      // the unchanged generic rabnmPrompt.
      for (const type of ["presidency_change", "baby_born", "mission_call", "aaronic_priesthood", "new_record", "recognition"]) {
        for (const item of rabnmByType.get(type) ?? []) {
          rows.push({ id: `rabnm-${item.id}`, kind: "field", label: item.type.replace(/_/g, " "), value: null, wording: rabnmPrompt(item) });
        }
      }

      continue;
    }

    // Stake Business is now fully spoken from inside Ward Business's
    // own block above, in its correct fixed position -- wherever this
    // element itself happens to sit in the real template, nothing
    // renders here anymore (2026-10-31).
    if (key === "stake_business") {
      continue;
    }

    // Announcements (2026-10-11, reworked 2026-10-31 per the user's
    // own script) -- 0 pulled: a standalone "refer to your programs"
    // cue (previously this showed nothing at all for the zero case).
    // 1+ pulled: an intro banner, one field row per pulled
    // announcement (unchanged announcementWording()), then a closing
    // banner pointing back to the programs for everything else.
    if (key === "announcements") {
      const announcements = announcementsByPlannedElement.get(el.id) ?? [];
      if (announcements.length === 0) {
        rows.push({
          id: el.id,
          kind: "banner",
          label: el.label,
          value: null,
          wording: "Please refer to your programs and online resources for announcements.",
        });
        continue;
      }
      rows.push({
        id: el.id,
        kind: "banner",
        label: el.label,
        value: null,
        wording: "We would like to draw your attention to a few announcements.",
      });
      for (const item of announcements) {
        rows.push({ id: `announcement-${item.id}`, kind: "field", label: item.title, value: item.title, wording: announcementWording(item) });
      }
      rows.push({
        id: `${el.id}-trailer`,
        kind: "banner",
        label: el.label,
        value: null,
        wording: "For all other announcements please see your programs and online resources.",
      });
      continue;
    }

    // Visiting Authorities (2026-10-03, migration 053; reworded
    // 2026-10-31) -- "title + FULL name" (formatTitleFullName, not the
    // title + last-name convention used for the ward's own leaders),
    // per the user's own explicit instruction. Skipped entirely when
    // none are recognized, same as before.
    if (key === "visiting_authorities") {
      if (visitingAuthorities.length === 0) continue;
      const names = visitingAuthorities.map((v) => {
        if (!v.personId) return v.displayName || BLANK;
        const prefix = titlePrefixByKey.get(`visiting_authorities::${v.personId}`);
        return formatTitleFullName(v.displayName || BLANK, prefix);
      });
      const wording =
        names.length === 1
          ? `We would like to recognize ${names[0]} on the stand with us today.`
          : `We would like to recognize ${joinWithAnd(names)} visiting with us today.`;
      rows.push({ id: el.id, kind: "field", label: el.label, value: names.join(", "), wording });
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
        // No longer spoken here (2026-10-31) -- Ward Business's own
        // opening line now thanks both, unconditionally; saying it
        // twice would be redundant. The value above still shows both
        // names for quick reference.
        wording: null,
      });
      continue;
    }

    if (key === "sacrament_hymn") {
      rows.push({ id: `${el.id}-section`, kind: "section", label: "Administration of the Sacrament", value: null, wording: null });
      rows.push({
        id: el.id,
        kind: "field",
        label: el.label,
        value: hymnValue(sacramentHymnItem),
        // Suppressed whenever Stake Business or Baby Blessing already
        // said this same transition sentence this meeting (2026-10-31,
        // confirmed with the user) -- said exactly once, never twice.
        wording: transitionAlreadyAnnounced ? null : sacramentTransitionSentence || null,
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
      rows.push({
        id: `${el.id}-thanks`,
        kind: "banner",
        label: "Closing Remarks",
        value: null,
        wording: "Thank you for your participation in today's meeting. (Share any reminders about the upcoming week as needed.)",
      });
    }

    switch (el.resolution_kind) {
      case "person_role": {
        const name = personName(roleAssignedId(key), key);
        const wording =
          key === "opening_prayer"
            ? `We will then have our opening prayer by ${name}.`
            : key === "closing_prayer"
              ? `We will then have our closing prayer by ${name}.`
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
        const name = note?.person_id ? personName(note.person_id, key) : null;
        const value = [name, note?.text_value].filter(Boolean).join(" — ") || BLANK;
        rows.push({ id: el.id, kind: "field", label: el.label, value, wording: null });
        break;
      }

      case "music": {
        const item = (musicByType.get(key) ?? [])[0];
        const isSingleton = SINGLETON_MUSIC_TYPES.includes(key);
        const wording =
          isSingleton && item
            ? key === "opening_hymn"
              ? `We will begin our meeting by singing hymn number ${item.hymn_number ?? "?"}, ${item.piece_name ?? "(title not entered)"}.`
              : `We will now close by singing hymn number ${item.hymn_number ?? "?"}, ${item.piece_name ?? "(title not entered)"}.`
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

    // Introductions (2026-10-31, the user's own script) -- injected
    // right after Conducting's own row, the same spot "Recognize
    // Authorities" was already injected from (below) -- needs both
    // names together, which a per-element dispatch can't know on its
    // own, so this is resolved once, up front (see presidingName/
    // conductingName above), independent of iteration order.
    if (key === "conducting") {
      rows.push({
        id: "introductions",
        kind: "banner",
        label: "Introductions",
        value: null,
        wording: `I am ${conductingName} and I will be conducting today. ${presidingName} is presiding in this meeting.`,
      });
    }

    // Recognize Authorities (2026-09-10): not a real template element --
    // `sacrament_planning.recognitions` has never had one -- so it's
    // injected right after Conducting, matching where the original
    // hand-written script always placed it. Unrelated to Visiting
    // Authorities above; left completely unchanged by this rewrite.
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
