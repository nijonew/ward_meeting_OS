import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createCacheableClient } from "@/lib/supabase/cacheable-client";
import { getMeetingById } from "@/lib/data/meetings";
import { getSacramentProgramItems } from "@/lib/data/sacrament-program";
import { kindOfItemKey } from "@/lib/data/sacrament-program-shared";
import { getTitlePrefixesForAssignments, formatTitleLastName } from "@/lib/data/person-display";
import { getHymnalIndex } from "@/lib/data/hymnal";
import { resolveHymnUrl } from "@/lib/data/hymnal-shared";

export interface PublicOrderItem {
  heading: string;
  detail: string | null;
  /** The hymn's own official page, when `detail` names one (Opening/
   *  Sacrament/Intermediate/Closing Hymn only -- never a Musical
   *  Number, which isn't necessarily in Music Reference at all) and
   *  Music Reference has a link on file for it -- see migration 101.
   *  2026-11-05, the user's own request: "I would like for hymns
   *  titles when shown in the public programs to be hyperlinks to the
   *  associated hymn pages on the site." */
  url?: string | null;
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

interface RawSacramentData {
  specialFormat: string;
  assignments: RawAssignment[];
  adults: RawSpeaker[];
  youth: RawSpeaker[];
  music: RawMusic[];
  rabnm: RawRabnm[];
  rabnmPeopleByRabnmId: Map<string, string[]>;
  nameById: Map<string, string>;
}

/** Plain-object shape `RawSacramentData` is serialized to across the
 *  `unstable_cache` boundary -- a `Map` doesn't survive
 *  JSON (de)serialization, so the cached fetcher below returns this
 *  instead and `toRawSacramentData` reconstructs the real Maps
 *  immediately after, so every line of `assembleView` can stay
 *  completely unaware the data might have come from a cache. */
interface SerializableRawSacramentData {
  specialFormat: string;
  assignments: RawAssignment[];
  adults: RawSpeaker[];
  youth: RawSpeaker[];
  music: RawMusic[];
  rabnm: RawRabnm[];
  rabnmPeopleByRabnmId: Record<string, string[]>;
  nameById: Record<string, string>;
}

function toRawSacramentData(s: SerializableRawSacramentData): RawSacramentData {
  return {
    specialFormat: s.specialFormat,
    assignments: s.assignments,
    adults: s.adults,
    youth: s.youth,
    music: s.music,
    rabnm: s.rabnm,
    rabnmPeopleByRabnmId: new Map(Object.entries(s.rabnmPeopleByRabnmId)),
    nameById: new Map(Object.entries(s.nameById)),
  };
}

/**
 * The actual row-level fetch, parameterized by which Supabase client
 * to use -- shared between the always-live path (the caller's own
 * cookie-based client) and the cached path below (a plain anon-key
 * client, required since `unstable_cache` can't call anything that
 * reads `cookies()`). Every query here is identical to what this file
 * always ran directly inside `getPublicSacramentView` before
 * 2026-11-14 -- only WHERE the client comes from changed, not what's
 * asked for.
 */
async function fetchRawSacramentData(
  meetingId: string,
  supabase: ReturnType<typeof createCacheableClient>
): Promise<RawSacramentData> {
  const [formatRes, assignmentsRes, adultsRes, youthRes, musicRes, rabnmRes] = await Promise.all([
    supabase.rpc("get_meeting_special_format", { p_meeting_id: meetingId }),
    supabase.from("sacrament_assignments").select("role, assigned_to_id, guest_name").eq("meeting_id", meetingId),
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

  // Baby Blessing items can name more than one child -- fetch the
  // linked people separately, keyed by rabnm_id.
  const rabnmIds = rabnm.map((r) => r.id);
  const rabnmPeopleRows =
    rabnmIds.length > 0
      ? ((await supabase.from("sacrament_rabnm_people").select("rabnm_id, person_id").in("rabnm_id", rabnmIds)).data ??
        [])
      : [];

  const rabnmPeopleByRabnmId = new Map<string, string[]>();
  for (const row of rabnmPeopleRows as { rabnm_id: string; person_id: string }[]) {
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

  return {
    specialFormat: (formatRes.data as string | null) ?? "standard",
    assignments,
    adults,
    youth,
    music,
    rabnm,
    rabnmPeopleByRabnmId,
    nameById,
  };
}

const CACHE_SECONDS = 20;

/**
 * The cached counterpart to `fetchRawSacramentData` above -- 2026-11-14,
 * a pinch-point audit before the app's own first real multi-user
 * rollout found this page (the single most-opened one in the app,
 * every Sunday, by the whole congregation at once) doing ~12
 * independent Supabase round trips with nothing shared between
 * concurrent viewers, unlike the small reference tables
 * (`hymnal_songs`, `ward_settings`, etc.) that already got a 5-minute
 * cross-request cache in the prior performance pass.
 *
 * A real `unstable_cache`, not just a shorter revalidate window on an
 * existing one -- this content changes far more often than those
 * reference tables (an admin can edit the program up to and during
 * the meeting itself, per the Vision workflow's own "updates in real
 * time... no separate publish step" rule), so a 20-second window was
 * chosen deliberately short: imperceptible as staleness in practice
 * (nobody is watching their own program auto-refresh second by
 * second), while still collapsing an entire burst of the whole
 * congregation opening the page within the same couple of minutes
 * down to roughly one real fetch instead of one per viewer.
 *
 * **Deliberately NOT used for a `sacrament_planning` holder's own
 * preview** (see `getPublicSacramentView` below) -- this uses a plain
 * anon-key client, which is correct for every genuinely public viewer
 * since the explicit `.eq("confirmed", true)`/`.eq("status",
 * "published")` filters above already narrow every query down to
 * exactly what an anonymous reader is allowed to see regardless of
 * which key fetched it. The one real exception: `sacrament_assignments`/
 * `sacrament_program_items`'s own anon-facing RLS policies (migration
 * 075) additionally require the meeting's own stage to not be
 * `archived` -- true for every meeting this cached path is ever
 * actually reached for (the page itself already blocks a non-admin
 * from reaching an archived meeting before calling this at all), but
 * NOT true for a Bishopric member previewing an already-archived
 * Sacrament Meeting, which this app's own Vision workflow explicitly
 * allows ("Bishopric keeps unconditional any-stage/any-date preview").
 * Routing that case through the anon-key client would silently return
 * empty results for an archived meeting instead of the real content --
 * a real regression, avoided entirely by keeping that one path fully
 * live and untouched.
 */
const fetchRawSacramentDataCached = unstable_cache(
  async (meetingId: string): Promise<SerializableRawSacramentData> => {
    const supabase = createCacheableClient();
    const raw = await fetchRawSacramentData(meetingId, supabase);
    return {
      specialFormat: raw.specialFormat,
      assignments: raw.assignments,
      adults: raw.adults,
      youth: raw.youth,
      music: raw.music,
      rabnm: raw.rabnm,
      rabnmPeopleByRabnmId: Object.fromEntries(raw.rabnmPeopleByRabnmId),
      nameById: Object.fromEntries(raw.nameById),
    };
  },
  ["public-sacrament-raw-data"],
  { revalidate: CACHE_SECONDS }
);

/**
 * Builds the finished `PublicSacramentView` from already-fetched raw
 * data -- the one place the actual program-assembly logic lives (item
 * order, hymn URLs, speaker/title resolution, Ward Business), shared
 * by both the live and cached entry points below so there's exactly
 * one implementation of this to ever get wrong, not two that could
 * quietly drift apart.
 */
function assembleView(
  meeting: { title: string; date: string },
  raw: RawSacramentData,
  programItems: Awaited<ReturnType<typeof getSacramentProgramItems>>,
  hymnalIndex: Awaited<ReturnType<typeof getHymnalIndex>>,
  titlePrefixByKey: Map<string, string>
): PublicSacramentView {
  const { assignments, adults, youth, music, rabnm, rabnmPeopleByRabnmId, nameById } = raw;

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
    url: openingHymn?.hymn_number ? resolveHymnUrl(openingHymn.hymn_number, hymnalIndex) : null,
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
    url: sacramentHymn?.hymn_number ? resolveHymnUrl(sacramentHymn.hymn_number, hymnalIndex) : null,
  });

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
        url: musicItem.hymn_number ? resolveHymnUrl(musicItem.hymn_number, hymnalIndex) : null,
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
    url: closingHymn?.hymn_number ? resolveHymnUrl(closingHymn.hymn_number, hymnalIndex) : null,
  });
  items.push({ heading: "Closing Prayer", detail: roleName("closing_prayer") });

  return {
    meetingTitle: meeting.title,
    meetingDate: meeting.date,
    specialFormat: raw.specialFormat,
    items,
  };
}

/** `getTitlePrefixesForAssignments` depends on `raw.assignments`, so
 *  it can't join the first wave of fetches -- same two-wave shape this
 *  file has always had, shared by both entry points below. */
async function resolveTitlePrefixes(raw: RawSacramentData): Promise<Map<string, string>> {
  const titlePairs = raw.assignments
    .filter((a) => a.assigned_to_id)
    .map((a) => ({ elementKey: a.role, personId: a.assigned_to_id as string }));
  return getTitlePrefixesForAssignments("sacrament-meeting", titlePairs);
}

/**
 * Always live, never cached -- for a `sacrament_planning` holder's own
 * preview (any stage, any date, including an already-archived
 * meeting), unchanged in every respect from how this file always
 * worked before 2026-11-14. See `getPublicSacramentViewCached` below
 * for the genuinely public path, and that function's own doc comment
 * for exactly why the two are kept separate.
 */
export async function getPublicSacramentView(meetingId: string): Promise<PublicSacramentView | null> {
  const supabase = await createClient();
  // getMeetingById doesn't need anything the wave below fetches (and
  // vice versa), so it runs concurrently with it instead of blocking
  // it first (2026-10-31, chasing the user's own "this app is
  // extremely slow" report).
  const meetingPromise = getMeetingById(meetingId);

  const [raw, programItems, hymnalIndex] = await Promise.all([
    fetchRawSacramentData(meetingId, supabase),
    getSacramentProgramItems(meetingId),
    getHymnalIndex(),
  ]);

  const meeting = await meetingPromise;
  if (!meeting) return null;

  const titlePrefixByKey = await resolveTitlePrefixes(raw);
  return assembleView(meeting, raw, programItems, hymnalIndex, titlePrefixByKey);
}

/**
 * The cached path -- for every viewer WITHOUT `sacrament_planning`
 * (the entire congregation, on a normal Sunday, which is the actual
 * concurrency concern this exists for). `app/meetings/[id]/public/page.tsx`
 * is the only caller, and it already resolves `sacrament_planning`
 * before deciding which of these two functions to call.
 */
export async function getPublicSacramentViewCached(meetingId: string): Promise<PublicSacramentView | null> {
  const meetingPromise = getMeetingById(meetingId);

  const [rawSerialized, programItems, hymnalIndex] = await Promise.all([
    fetchRawSacramentDataCached(meetingId),
    getSacramentProgramItems(meetingId),
    getHymnalIndex(),
  ]);
  const raw = toRawSacramentData(rawSerialized);

  const meeting = await meetingPromise;
  if (!meeting) return null;

  const titlePrefixByKey = await resolveTitlePrefixes(raw);
  return assembleView(meeting, raw, programItems, hymnalIndex, titlePrefixByKey);
}
