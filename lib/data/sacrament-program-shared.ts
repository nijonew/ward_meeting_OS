/**
 * Pure helpers/types for the Speakers & Music list (see
 * lib/data/sacrament-program.ts for the full writeup and the actual
 * data fetch) -- split into its own file with no `createClient` import
 * so SacramentProgramSection (a Client Component) can import from it
 * directly. sacrament-program.ts itself imports `next/headers`
 * transitively via lib/supabase/server -- pulling that into a client
 * bundle fails the build outright ("You're importing a module that
 * depends on next/headers... in the Pages Router"), even though this
 * file is only ever used from Server Components in the App Router.
 */

export type ProgramItemKind = "youth_speaker" | "speaker" | "musical_number" | "intermediate_hymn" | "testimony";

export interface ProgramItemOption {
  key: string; // e.g. "speaker_3", or "testimony"
  label: string; // e.g. "Speaker 3", or "Testimony"
  kind: ProgramItemKind;
}

/** Every selectable item, in the order they should list in the "Add"
 *  dropdown -- youth speakers, then speakers, then musical numbers
 *  (each 1-9, per the user's own numbers), then the two unnumbered
 *  options. */
export function allProgramItemOptions(): ProgramItemOption[] {
  const options: ProgramItemOption[] = [];
  const numbered: { kind: ProgramItemKind; label: string }[] = [
    { kind: "youth_speaker", label: "Youth Speaker" },
    { kind: "speaker", label: "Speaker" },
    { kind: "musical_number", label: "Musical Number" },
  ];
  for (const { kind, label } of numbered) {
    for (let n = 1; n <= 9; n++) {
      options.push({ key: `${kind}_${n}`, label: `${label} ${n}`, kind });
    }
  }
  options.push({ key: "intermediate_hymn", label: "Intermediate Hymn", kind: "intermediate_hymn" });
  options.push({ key: "testimony", label: "Testimony", kind: "testimony" });
  return options;
}

/** item_key -> kind, without needing the full option list -- Intermediate
 *  Hymn can repeat (unlike Testimony), so its underlying slot is
 *  auto-numbered ("intermediate_hymn_1", "_2", ...) the first time it's
 *  picked from the dropdown's single unnumbered "Intermediate Hymn"
 *  option, same numbering scheme sacrament_music.slot already used
 *  before this rework. */
export function kindOfItemKey(itemKey: string): ProgramItemKind {
  if (itemKey === "testimony") return "testimony";
  if (itemKey.startsWith("intermediate_hymn")) return "intermediate_hymn";
  if (itemKey.startsWith("youth_speaker_")) return "youth_speaker";
  if (itemKey.startsWith("speaker_")) return "speaker";
  return "musical_number";
}

export interface ProgramItemRow {
  id: string;
  itemKey: string;
  sortOrder: number;
}

/** "Speaker 3" from "speaker_3"; "Intermediate Hymn" (unadorned) for the
 *  first one, "Intermediate Hymn 2" for a second -- the dropdown option
 *  itself has no number, so only a repeat needs one to stay
 *  distinguishable. */
export function itemLabel(itemKey: string): string {
  const kind = kindOfItemKey(itemKey);
  if (kind === "testimony") return "Testimony";
  if (kind === "intermediate_hymn") {
    const n = itemKey.replace("intermediate_hymn_", "").replace("intermediate_hymn", "");
    return n && n !== "1" ? `Intermediate Hymn ${n}` : "Intermediate Hymn";
  }
  const label = kind === "youth_speaker" ? "Youth Speaker" : kind === "speaker" ? "Speaker" : "Musical Number";
  return `${label} ${itemKey.split("_").pop()}`;
}

export interface ResolvedProgramItem {
  id: string;
  itemKey: string;
  kind: ProgramItemKind;
  label: string;
  personId: string;
  guestName: string;
  hymnNumber: string;
  title: string;
  performer: string;
  accompanistId: string;
}

/** Resolves each ordering row's current data out of the same
 *  sacrament_speakers_adults/youth and sacrament_music arrays every
 *  other part of the planning view already fetches -- this table never
 *  duplicates that data, it only records order and membership. */
export function resolveProgramItems(
  items: ProgramItemRow[],
  music: { slot: string | null; hymn_number: number | null; piece_name: string | null; group_name: string | null; individual_name: string | null; accompanist_id: string | null }[],
  speakersAdults: { slot: string; speaker_id: string | null; guest_speaker_name: string | null }[],
  speakersYouth: { slot: string; speaker_id: string | null; guest_speaker_name: string | null }[]
): ResolvedProgramItem[] {
  const musicBySlot = new Map(music.filter((m) => m.slot).map((m) => [m.slot as string, m]));
  const adultBySlot = new Map(speakersAdults.map((s) => [s.slot, s]));
  const youthBySlot = new Map(speakersYouth.map((s) => [s.slot, s]));

  return items.map((item) => {
    const kind = kindOfItemKey(item.itemKey);
    const label = itemLabel(item.itemKey);

    if (kind === "speaker" || kind === "youth_speaker") {
      const existing = (kind === "speaker" ? adultBySlot : youthBySlot).get(item.itemKey);
      return {
        id: item.id,
        itemKey: item.itemKey,
        kind,
        label,
        personId: existing?.speaker_id ?? "",
        guestName: existing?.guest_speaker_name ?? "",
        hymnNumber: "",
        title: "",
        performer: "",
        accompanistId: "",
      };
    }

    if (kind === "musical_number" || kind === "intermediate_hymn") {
      const existing = musicBySlot.get(item.itemKey);
      return {
        id: item.id,
        itemKey: item.itemKey,
        kind,
        label,
        personId: "",
        guestName: "",
        hymnNumber: existing?.hymn_number != null ? String(existing.hymn_number) : "",
        title: existing?.piece_name ?? "",
        performer: existing?.group_name ?? existing?.individual_name ?? "",
        accompanistId: existing?.accompanist_id ?? "",
      };
    }

    // testimony -- nothing to resolve, it's a placeholder line.
    return {
      id: item.id,
      itemKey: item.itemKey,
      kind,
      label,
      personId: "",
      guestName: "",
      hymnNumber: "",
      title: "",
      performer: "",
      accompanistId: "",
    };
  });
}
