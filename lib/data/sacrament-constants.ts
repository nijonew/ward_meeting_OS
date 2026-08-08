export const SPECIAL_FORMATS = [
  { value: "standard", label: "Standard" },
  { value: "testimony_meeting", label: "Testimony Meeting" },
  { value: "stake_conference", label: "Stake Conference" },
  { value: "general_conference", label: "General Conference" },
  { value: "primary_program", label: "Primary Program" },
  { value: "christmas_meeting", label: "Christmas Meeting" },
  { value: "easter_meeting", label: "Easter Meeting" },
  { value: "missionary_speaker", label: "Missionary Speaker" },
  { value: "stake_speakers", label: "Stake Speakers" },
  { value: "baby_blessing", label: "Baby Blessing" },
] as const;

export const ASSIGNMENT_ROLES = [
  { value: "presiding", label: "Presiding" },
  { value: "conducting", label: "Conducting" },
  { value: "opening_prayer", label: "Opening Prayer" },
  { value: "closing_prayer", label: "Closing Prayer" },
  { value: "chorister", label: "Chorister" },
  { value: "organist", label: "Organist" },
  { value: "ushers", label: "Ushers" },
] as const;

export const SPEAKER_SLOTS_ADULT = [
  "speaker_1",
  "speaker_2",
  "speaker_3",
  "speaker_4",
  "speaker_5",
  "speaker_6",
  "speaker_7",
  "speaker_8",
  "speaker_9",
] as const;

export const SPEAKER_SLOTS_YOUTH = [
  "youth_speaker_1",
  "youth_speaker_2",
  "youth_speaker_3",
  "youth_speaker_4",
  "youth_speaker_5",
  "youth_speaker_6",
  "youth_speaker_7",
  "youth_speaker_8",
  "youth_speaker_9",
] as const;

export const MUSIC_ARRANGE_SLOTS = [
  "intermediate_hymn_1",
  "intermediate_hymn_2",
  "intermediate_hymn_3",
  "musical_number_1",
  "musical_number_2",
  "musical_number_3",
  "musical_number_4",
  "musical_number_5",
  "musical_number_6",
] as const;

export const RABNM_TYPES = [
  { value: "release", label: "Release" },
  { value: "new_calling", label: "New Calling" },
  { value: "presidency_change", label: "Presidency Change" },
  { value: "baby_born", label: "Baby Born" },
  { value: "mission_call", label: "Mission Call" },
  { value: "aaronic_priesthood", label: "Aaronic Priesthood" },
  { value: "baptism", label: "Baptism" },
  { value: "new_record", label: "New Record" },
  { value: "baby_blessing", label: "Baby Blessing" },
] as const;

/** "speaker_3" -> "Speaker 3", "youth_speaker_1" -> "Youth Speaker 1" */
export function slotLabel(slot: string): string {
  return slot
    .split("_")
    .map((word) => (Number.isNaN(Number(word)) ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export const MUSIC_TYPES = [
  { value: "opening_hymn", label: "Opening Hymn" },
  { value: "sacrament_hymn", label: "Sacrament Hymn" },
  { value: "closing_hymn", label: "Closing Hymn" },
  { value: "intermediate_hymn", label: "Intermediate Hymn" },
  { value: "musical_number", label: "Musical Number" },
] as const;

export type MusicTypeValue = (typeof MUSIC_TYPES)[number]["value"];

/** Accepts loose spreadsheet text ("opening hymn", "Musical Number", etc.)
 *  and maps it to a valid type value, or null if unrecognized. */
export function normalizeMusicType(input: string): MusicTypeValue | null {
  const cleaned = input.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const match = MUSIC_TYPES.find((t) => t.value === cleaned);
  return match ? match.value : null;
}