import { createClient } from "@/lib/supabase/server";
import { getMeetingById } from "@/lib/data/meetings";

export interface PublicOrderItem {
  heading: string;
  detail: string | null;
}

export interface PublicSacramentView {
  meetingTitle: string;
  meetingDate: string;
  specialFormat: string;
  items: PublicOrderItem[];
}

interface RawAssignment {
  role: string;
  assigned_to_id: string | null;
}
interface RawSpeaker {
  slot: string;
  speaker_id: string | null;
  guest_speaker_name: string | null;
  topic: string | null;
}
interface RawMusic {
  id: string;
  type: string;
  slot: string | null;
  hymn_number: number | null;
  piece_name: string | null;
  individual_id: string | null;
  group_name: string | null;
  accompanist_id: string | null;
}
interface RawRabnm {
  id: string;
  detail: string | null;
}

export async function getPublicSacramentView(meetingId: string): Promise<PublicSacramentView | null> {
  const supabase = await createClient();
  const meeting = await getMeetingById(meetingId);
  if (!meeting) return null;

  const [
    formatRes,
    assignmentsRes,
    adultsRes,
    youthRes,
    musicRes,
    rabnmRes,
    rabnmPeopleRes,
  ] = await Promise.all([
    supabase.rpc("get_meeting_special_format", { p_meeting_id: meetingId }),
    supabase
      .from("sacrament_assignments")
      .select("role, assigned_to_id")
      .eq("meeting_id", meetingId)
      .eq("confirmed", true),
    supabase
      .from("sacrament_speakers_adults")
      .select("slot, speaker_id, guest_speaker_name, topic")
      .eq("meeting_id", meetingId)
      .eq("confirmed", true),
    supabase
      .from("sacrament_speakers_youth")
      .select("slot, speaker_id, guest_speaker_name, topic")
      .eq("meeting_id", meetingId)
      .eq("confirmed", true),
    supabase
      .from("sacrament_music")
      .select("id, type, slot, hymn_number, piece_name, individual_id, group_name, accompanist_id")
      .eq("meeting_id", meetingId)
      .eq("status", "published"),
    supabase.from("sacrament_rabnm").select("id, detail").eq("meeting_id", meetingId).eq("type", "baby_blessing"),
  ]);

  const assignments = (assignmentsRes.data ?? []) as RawAssignment[];
  const adults = (adultsRes.data ?? []) as RawSpeaker[];
  const youth = (youthRes.data ?? []) as RawSpeaker[];
  const music = (musicRes.data ?? []) as RawMusic[];
  const rabnm = (rabnmRes.data ?? []) as RawRabnm[];

  // Baby Blessing items can name more than one child -- fetch the linked
  // people separately, keyed by rabnm_id.
  const rabnmIds = rabnm.map((r) => r.id);
  const rabnmPeopleByRabnmId = new Map<string, string[]>();
  if (rabnmIds.length > 0) {
    const { data: rabnmPeople } = await supabase
      .from("sacrament_rabnm_people")
      .select("rabnm_id, person_id")
      .in("rabnm_id", rabnmIds);

    for (const row of (rabnmPeople ?? []) as { rabnm_id: string; person_id: string }[]) {
      const list = rabnmPeopleByRabnmId.get(row.rabnm_id) ?? [];
      list.push(row.person_id);
      rabnmPeopleByRabnmId.set(row.rabnm_id, list);
    }
  }

  // Batch-resolve every person id referenced above into a name, via the
  // column-limited function (never a direct people table query).
  const idSet = new Set<string>();
  assignments.forEach((a) => a.assigned_to_id && idSet.add(a.assigned_to_id));
  [...adults, ...youth].forEach((s) => s.speaker_id && idSet.add(s.speaker_id));
  music.forEach((m) => {
    if (m.individual_id) idSet.add(m.individual_id);
    if (m.accompanist_id) idSet.add(m.accompanist_id);
  });
  rabnmPeopleByRabnmId.forEach((ids) => ids.forEach((id) => idSet.add(id)));

  const { data: peopleRows } = await supabase.rpc("get_public_people_names", {
    p_ids: Array.from(idSet),
  });
  const nameById = new Map(((peopleRows ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
  const roleName = (role: string) => {
    const a = assignments.find((x) => x.role === role);
    return a?.assigned_to_id ? (nameById.get(a.assigned_to_id) ?? null) : null;
  };
  const speakerName = (s: RawSpeaker) =>
    s.speaker_id ? (nameById.get(s.speaker_id) ?? null) : (s.guest_speaker_name ?? null);

  const items: PublicOrderItem[] = [];

  items.push({ heading: "Presiding", detail: roleName("presiding") });
  items.push({ heading: "Conducting", detail: roleName("conducting") });

  const openingHymn = music.find((m) => m.type === "opening_hymn");
  items.push({
    heading: "Opening Hymn",
    detail: openingHymn ? `${openingHymn.hymn_number ?? ""} ${openingHymn.piece_name ?? ""}`.trim() : null,
  });
  items.push({ heading: "Opening Prayer", detail: roleName("opening_prayer") });

  const chorister = roleName("chorister");
  const organist = roleName("organist");
  if (chorister) items.push({ heading: "Chorister", detail: chorister });
  if (organist) items.push({ heading: "Organist", detail: organist });

  items.push({ heading: "Ward Business", detail: null });

  const sacramentHymn = music.find((m) => m.type === "sacrament_hymn");
  items.push({
    heading: "Administration of the Sacrament",
    detail: sacramentHymn
      ? `Sacrament Hymn: ${sacramentHymn.hymn_number ?? ""} ${sacramentHymn.piece_name ?? ""}`.trim()
      : null,
  });

  const specialFormat = (formatRes.data as string | null) ?? "standard";

  if (specialFormat === "testimony_meeting") {
    items.push({ heading: "Testimonies", detail: null });
  } else {
    const sortedYouth = [...youth].sort((a, b) => a.slot.localeCompare(b.slot));
    for (const s of sortedYouth) {
      items.push({ heading: "Youth Speaker", detail: speakerName(s) });
    }

    const intermediateHymns = music
      .filter((m) => m.type === "intermediate_hymn")
      .sort((a, b) => (a.slot ?? "").localeCompare(b.slot ?? ""));
    for (const h of intermediateHymns) {
      items.push({ heading: "Intermediate Hymn", detail: `${h.hymn_number ?? ""} ${h.piece_name ?? ""}`.trim() });
    }

    const musicalNumbers = music
      .filter((m) => m.type === "musical_number")
      .sort((a, b) => (a.slot ?? "").localeCompare(b.slot ?? ""));
    for (const n of musicalNumbers) {
      const performer = n.group_name || (n.individual_id ? nameById.get(n.individual_id) : null);
      items.push({
        heading: "Musical Number",
        detail: [n.piece_name, performer].filter(Boolean).join(" — ") || null,
      });
    }

    const sortedAdults = [...adults].sort((a, b) => a.slot.localeCompare(b.slot));
    for (const s of sortedAdults) {
      items.push({ heading: "Speaker", detail: speakerName(s) });
    }
  }

  if (rabnm.length > 0) {
    for (const item of rabnm) {
      const childNames = (rabnmPeopleByRabnmId.get(item.id) ?? [])
        .map((id) => nameById.get(id))
        .filter((name): name is string => Boolean(name));
      const detail = [childNames.join(", "), item.detail].filter(Boolean).join(" — ") || null;
      items.push({ heading: "Baby Blessing", detail });
    }
  }

  const closingHymn = music.find((m) => m.type === "closing_hymn");
  items.push({
    heading: "Closing Hymn",
    detail: closingHymn ? `${closingHymn.hymn_number ?? ""} ${closingHymn.piece_name ?? ""}`.trim() : null,
  });
  items.push({ heading: "Closing Prayer", detail: roleName("closing_prayer") });

  return {
    meetingTitle: meeting.title,
    meetingDate: meeting.date,
    specialFormat,
    items,
  };
}