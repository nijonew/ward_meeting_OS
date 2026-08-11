import { getSacramentPlanningData, type RabnmRow, type SpeakerRow } from "@/lib/data/sacrament-planning";
import { getActivePeople } from "@/lib/data/people";
import { getMeetingById } from "@/lib/data/meetings";
import { slotLabel } from "@/lib/data/sacrament-constants";

export interface ScriptLine {
  heading: string;
  prompt: string | null; // null = heading only, nothing to read aloud
}

export interface ConductingScript {
  meetingTitle: string;
  meetingDate: string;
  specialFormat: string;
  lines: ScriptLine[];
}

function rabnmPrompt(item: RabnmRow): string {
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

function speakerLine(row: SpeakerRow, peopleByName: Map<string, string>): string {
  const name = row.speaker_id ? (peopleByName.get(row.speaker_id) ?? "(speaker not entered)") : row.guest_speaker_name ?? "(speaker not entered)";
  const topic = row.topic ? ` speaking on: ${row.topic}` : "";
  return `${name}${topic}`;
}

export async function getConductingScript(meetingId: string): Promise<ConductingScript | null> {
  const [meeting, data, people] = await Promise.all([
    getMeetingById(meetingId),
    getSacramentPlanningData(meetingId),
    getActivePeople(),
  ]);

  if (!meeting) return null;

  const peopleById = new Map(people.map((p) => [p.id, p.name]));
  const roleName = (role: string) => {
    const assignment = data.assignments.find((a) => a.role === role);
    if (!assignment?.assigned_to_id) return "(not assigned)";
    return peopleById.get(assignment.assigned_to_id) ?? "(not assigned)";
  };

  const lines: ScriptLine[] = [];

  lines.push({
    heading: "Title",
    prompt: `Welcome to today's Sacrament Meeting of The Church of Jesus Christ of Latter-day Saints.`,
  });

  lines.push({ heading: "Presiding", prompt: `${roleName("presiding")} is presiding in this meeting.` });
  lines.push({ heading: "Conducting", prompt: `I am ${roleName("conducting")} and am conducting this meeting.` });

  if (data.planning?.recognitions) {
    lines.push({
      heading: "Recognize Authorities",
      prompt: `We would like to recognize ${data.planning.recognitions} who is/are here with us today.`,
    });
  }

  const openingHymn = data.music.find((m) => m.type === "opening_hymn");
  lines.push({
    heading: "Opening Hymn",
    prompt: openingHymn
      ? `We will open our meeting by singing hymn number ${openingHymn.hymn_number ?? "?"}, ${openingHymn.piece_name ?? "(title not entered)"}, after which...`
      : "(opening hymn not entered)",
  });

  lines.push({ heading: "Opening Prayer", prompt: `...${roleName("opening_prayer")} will offer our opening prayer.` });

  const chorister = roleName("chorister");
  const organist = roleName("organist");
  lines.push({
    heading: "Recognize Music",
    prompt: `We would like to thank ${chorister} for conducting our music today, and ${organist} as our organist.`,
  });

  if (
    data.planning?.ward_business ||
    data.rabnm.length > 0 ||
    (data.planning?.special_format && data.planning.special_format !== "standard")
  ) {
    lines.push({ heading: "Ward Business", prompt: null });
    if (data.planning?.ward_business) {
      lines.push({ heading: "Ward Business Notes", prompt: data.planning.ward_business });
    }
    for (const item of data.rabnm) {
      lines.push({ heading: item.type.replace(/_/g, " "), prompt: rabnmPrompt(item) });
    }
  }

  if (data.planning?.stake_business) {
    lines.push({ heading: "Stake Business", prompt: data.planning.stake_business });
  }

  const sacramentHymn = data.music.find((m) => m.type === "sacrament_hymn");
  lines.push({
    heading: "Prepare for the Sacrament",
    prompt: sacramentHymn
      ? `We will now prepare for the administration of the sacrament by singing hymn number ${sacramentHymn.hymn_number ?? "?"}, ${sacramentHymn.piece_name ?? "(title not entered)"}.`
      : "(sacrament hymn not entered)",
  });

  lines.push({ heading: "Administration of the Sacrament", prompt: null });

  lines.push({
    heading: "After the Sacrament",
    prompt:
      "Thank you for your reverence during the administration of the sacrament. Thank you to the priesthood holders who administered the sacrament to us.",
  });

  // Program
  lines.push({ heading: "Program", prompt: null });

  if (data.planning?.special_format === "testimony_meeting") {
    lines.push({
      heading: "Testimonies",
      prompt: "We now invite members of the ward to bear their testimonies.",
    });
  } else {
    const youthSpeakers = data.speakersYouth
      .filter((s) => s.speaker_id || s.guest_speaker_name)
      .sort((a, b) => a.slot.localeCompare(b.slot));
    for (const speaker of youthSpeakers) {
      lines.push({ heading: slotLabel(speaker.slot), prompt: speakerLine(speaker, peopleById) });
    }

    const intermediateHymns = data.music
      .filter((m) => m.type === "intermediate_hymn" && m.slot)
      .sort((a, b) => (a.slot ?? "").localeCompare(b.slot ?? ""));
    for (const hymn of intermediateHymns) {
      lines.push({
        heading: slotLabel(hymn.slot ?? "Intermediate Hymn"),
        prompt: `Intermediate hymn number ${hymn.hymn_number ?? "?"}, ${hymn.piece_name ?? "(title not entered)"}.`,
      });
    }

    const musicalNumbers = data.music
      .filter((m) => m.type === "musical_number" && m.slot)
      .sort((a, b) => (a.slot ?? "").localeCompare(b.slot ?? ""));
    for (const number of musicalNumbers) {
      const performer = number.group_name || number.individual_name || "(performer not entered)";
      lines.push({
        heading: slotLabel(number.slot ?? "Musical Number"),
        prompt: `We will now be favored with a musical number, "${number.piece_name ?? "(title not entered)"}", performed by ${performer}.`,
      });
    }

    const adultSpeakers = data.speakersAdults
      .filter((s) => s.speaker_id || s.guest_speaker_name)
      .sort((a, b) => a.slot.localeCompare(b.slot));
    for (const speaker of adultSpeakers) {
      lines.push({ heading: slotLabel(speaker.slot), prompt: speakerLine(speaker, peopleById) });
    }
  }

  const closingHymn = data.music.find((m) => m.type === "closing_hymn");
  lines.push({
    heading: "Closing Hymn",
    prompt: closingHymn
      ? `We will close the meeting by singing hymn number ${closingHymn.hymn_number ?? "?"}, ${closingHymn.piece_name ?? "(title not entered)"}, after which...`
      : "(closing hymn not entered)",
  });

  lines.push({ heading: "Closing Prayer", prompt: `...our closing prayer will be offered by ${roleName("closing_prayer")}.` });

  return {
    meetingTitle: meeting.title,
    meetingDate: meeting.date,
    specialFormat: data.planning?.special_format ?? "standard",
    lines,
  };
}
