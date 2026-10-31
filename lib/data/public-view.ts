import { createClient } from "@/lib/supabase/server";
import { getMeetingById } from "@/lib/data/meetings";
import { getSacramentProgramItems } from "@/lib/data/sacrament-program";
import { kindOfItemKey } from "@/lib/data/sacrament-program-shared";
import { getTitlePrefixesForAssignments, formatTitleLastName } from "@/lib/data/person-display";

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
  /** Chorister/Organist's guest option, migration 064. */
  guest_name: string | null;
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
  hymn_number: string | null;
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
  // getMeetingById doesn't need anything the wave below fetches (and
  // vice versa), so it runs concurrently with it instead of blocking
  // it first (2026-10-31, chasing the user's own "this app is
  // extremely slow" report) -- this is the single most-opened page in
  // the app by ordinary ward members, every Sunday.
  const meetingPromise = getMeetingById(meetingId);

  const [
    formatRes,
    assignmentsRes,
    adultsRes,
    youthRes,
    musicRes,
    rabnmRes,
    programItems,
  ] = await Promise.all([
    supabase.rpc("get_meeting_special_format", { p_meeting_id: meetingId }),
    supabase
      .from("sacrament_assignments")
      .select("role, assigned_to_id, guest_name")
      .eq("meeting_id", meetingId),
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
    getSacramentProgramItems(meetingId),
  ]);

  const meeting = await meetingPromise;
  if (!meeting) return null;

  const assignments = (assignmentsRes.data ?? []) as RawAssignment[];
  const adults = (adultsRes.data ?? []) as RawSpeaker[];
  const youth = (youthRes.data ?? []) as RawSpeaker[];
  const music = (musicRes.data ?? []) as RawMusic[];
  const rabnm = (rabnmRes.data ?? []) as RawRabnm[];

  // Baby Blessing items can name more than one child -- fetch the
  // linked people separately, keyed by rabnm_id. Independent of
  // "title + last name" resolution below (that one only needs
  // `assignments`, already in hand) -- the two run together rather
  // than one after the other.
  const rabnmIds = rabnm.map((r) => r.id);
  // "Title + last name" (2026-10-21) for any role resolved via a
  // calling -- see getTitlePrefixesForAssignments. **Known limitation
  // for a genuinely anonymous (no-login) viewer**: unlike
  // get_public_people_names below, this reads `callings` through the
  // ordinary client, which has no anon-facing RLS policy today -- it
  // degrades gracefully (plain names, no error) rather than crashing,
  // but an anonymous visitor to this specific page won't see the title
  // prefix; an admin/Bishopric preview (always authenticated) does. A
  // dedicated security-definer RPC, mirroring get_public_people_names,
  // would be the fix if extending this to anonymous viewers matters.
  const titlePairs = assignments
    .filter((a) => a.assigned_to_id)
    .map((a) => ({ elementKey: a.role, personId: a.assigned_to_id as string }));

  const [rabnmPeopleRows, titlePrefixByKey] = await Promise.all([
    rabnmIds.length > 0
      ? supabase
          .from("sacrament_rabnm_people")
          .select("rabnm_id, person_id")
          .in("rabnm_id", rabnmIds)
          .then((r) => r.data)
      : Promise.resolve([] as { rabnm_id: string; person_id: string }[] | null),
    getTitlePrefixesForAssignments("sacrament-meeting", titlePairs),
  ]);

  const rabnmPeopleByRabnmId = new Map<string, string[]>();
  for (const row of (rabnmPeopleRows ?? []) as { rabnm_id: string; person_id: string }[]) {
    const list = rabnmPeopleByRabnmId.get(row.rabnm_id) ?? [];
    list.push(row.person_id);
    rabnmPeopleByRabnmId.set(row.rabnm_id, list);
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
    if (!a) return null;
    if (a.assigned_to_id) {
      const name = nameById.get(a.assigned_to_id) ?? null;
      if (!name) return null;
      return formatTitleLastName(name, titlePrefixByKey.get(`${role}::${a.assigned_to_id}`));
    }
    return a.guest_name ?? null;
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

  // Ward Business, as a real public section (2026-10-30, the user's
  // own request: "Add ward business as a general section of the
  // public sacrament meeting program"). Scoped to just Baby Blessings
  // for now, per the user's own confirmed choice -- Callings/Releases
  // and every other RABNM category stay admin-only, matching this
  // app's own established privacy rule for those. Only shown at all
  // when there's actually a baby blessing to report -- unlike before,
  // when this heading rendered unconditionally with nothing under it.
  if (rabnm.length > 0) {
    items.push({ heading: "Ward Business", detail: null });
    for (const item of rabnm) {
      const childNames = (rabnmPeopleByRabnmId.get(item.id) ?? [])
        .map((id) => nameById.get(id))
        .filter((name): name is string => Boolean(name));
      const detail = [childNames.join(", "), item.detail].filter(Boolean).join(" — ") || null;
      items.push({ heading: "Naming and Blessing of Children", detail });
    }
  }

  const sacramentHymn = music.find((m) => m.type === "sacrament_hymn");
  items.push({
    heading: "Administration of the Sacrament",
    detail: sacramentHymn
      ? `Sacrament Hymn: ${sacramentHymn.hymn_number ?? ""} ${sacramentHymn.piece_name ?? ""}`.trim()
      : null,
  });

  const specialFormat = (formatRes.data as string | null) ?? "standard";

  // Speakers & Music, in the meeting's own chosen order (2026-09-10) --
  // this used to be grouped by type (all youth speakers, then
  // intermediate hymns, then musical numbers, then adult speakers)
  // regardless of the order actually saved; now that the planning view
  // lets these interleave freely (sacrament_program_items), the public
  // program has to follow the same real order or it stops matching
  // what's on the agenda. An item not found in its already-filtered
  // source array (an unconfirmed speaker, an unpublished music item)
  // is skipped, same as it always silently was.
  const adultBySlot = new Map(adults.map((s) => [s.slot, s]));
  const youthBySlot = new Map(youth.map((s) => [s.slot, s]));
  const musicBySlot = new Map(music.filter((m) => m.slot).map((m) => [m.slot as string, m]));

  for (const item of programItems) {
    const kind = kindOfItemKey(item.itemKey);
    if (kind === "testimony") {
      items.push({ heading: "Testimonies", detail: null });
      continue;
    }
    if (kind === "primary_program") {
      items.push({ heading: "Primary Program", detail: null });
      continue;
    }
    if (kind === "speaker" || kind === "youth_speaker") {
      const speaker = (kind === "speaker" ? adultBySlot : youthBySlot).get(item.itemKey);
      if (!speaker) continue;
      items.push({ heading: kind === "speaker" ? "Speaker" : "Youth Speaker", detail: speakerName(speaker) });
      continue;
    }
    const musicItem = musicBySlot.get(item.itemKey);
    if (!musicItem) continue;
    if (kind === "intermediate_hymn") {
      items.push({
        heading: "Intermediate Hymn",
        detail: `${musicItem.hymn_number ?? ""} ${musicItem.piece_name ?? ""}`.trim(),
      });
    } else {
      const performer = musicItem.group_name || (musicItem.individual_id ? nameById.get(musicItem.individual_id) : null);
      items.push({
        heading: "Musical Number",
        detail: [musicItem.piece_name, performer].filter(Boolean).join(" — ") || null,
      });
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