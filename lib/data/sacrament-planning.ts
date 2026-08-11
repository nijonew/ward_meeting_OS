import { createClient } from "@/lib/supabase/server";

// NOTE: no generated Database types are wired up yet, so relation joins
// below are handled with light `any` casts rather than strict typing.
// A follow-up with `supabase gen types typescript` would clean this up.

export interface PlanningInfo {
  special_format: string;
  ward_business: string | null;
  stake_business: string | null;
  recognitions: string | null;
  hidden_notes: string | null;
}

export interface AssignmentRow {
  role: string;
  assigned_to_id: string | null;
  confirmed: boolean;
}

export interface SpeakerRow {
  slot: string;
  speaker_id: string | null;
  guest_speaker_name: string | null;
  topic: string | null;
  duration: string | null;
  confirmed: boolean;
}

export interface MusicRow {
  id: string;
  type: string;
  slot: string | null;
  hymn_number: number | null;
  piece_name: string | null;
  individual_name: string | null;
  group_name: string | null;
  accompanist_name: string | null;
  status: string;
}

export interface RabnmRow {
  id: string;
  type: string;
  calling_name: string | null;
  detail: string | null;
  event_date: string | null;
  people: string[];
}

export interface SacramentPlanningData {
  planning: PlanningInfo | null;
  assignments: AssignmentRow[];
  speakersAdults: SpeakerRow[];
  speakersYouth: SpeakerRow[];
  music: MusicRow[];
  rabnm: RabnmRow[];
}

function relationName(rel: unknown): string | null {
  if (Array.isArray(rel)) {
    return (rel[0] as { name?: string } | undefined)?.name ?? null;
  }
  return (rel as { name?: string } | null)?.name ?? null;
}

export async function getSacramentPlanningData(meetingId: string): Promise<SacramentPlanningData> {
  const supabase = await createClient();

  const [planningRes, assignmentsRes, adultsRes, youthRes, musicRes, rabnmRes] = await Promise.all([
    supabase
      .from("sacrament_planning")
      .select("special_format, ward_business, stake_business, recognitions, hidden_notes")
      .eq("meeting_id", meetingId)
      .maybeSingle(),
    supabase
      .from("sacrament_assignments")
      .select("role, assigned_to_id, confirmed")
      .eq("meeting_id", meetingId),
    supabase
      .from("sacrament_speakers_adults")
      .select("slot, speaker_id, guest_speaker_name, topic, duration, confirmed")
      .eq("meeting_id", meetingId),
    supabase
      .from("sacrament_speakers_youth")
      .select("slot, speaker_id, guest_speaker_name, topic, duration, confirmed")
      .eq("meeting_id", meetingId),
    supabase
      .from("sacrament_music")
      .select(
        "id, type, slot, hymn_number, piece_name, status, group_name, individual:individual_id(name), accompanist:accompanist_id(name)"
      )
      .eq("meeting_id", meetingId),
    supabase
      .from("sacrament_rabnm")
      .select("id, type, detail, event_date, callings(name), sacrament_rabnm_people(people(name))")
      .eq("meeting_id", meetingId),
  ]);

  return {
    planning: (planningRes.data as PlanningInfo | null) ?? null,
    assignments: (assignmentsRes.data as AssignmentRow[] | null) ?? [],
    speakersAdults: (adultsRes.data as SpeakerRow[] | null) ?? [],
    speakersYouth: (youthRes.data as SpeakerRow[] | null) ?? [],
    music: ((musicRes.data ?? []) as unknown[]).map((row) => {
      const r = row as {
        id: string;
        type: string;
        slot: string | null;
        hymn_number: number | null;
        piece_name: string | null;
        status: string;
        group_name: string | null;
        individual: unknown;
        accompanist: unknown;
      };
      return {
        id: r.id,
        type: r.type,
        slot: r.slot,
        hymn_number: r.hymn_number,
        piece_name: r.piece_name,
        individual_name: relationName(r.individual),
        group_name: r.group_name,
        accompanist_name: relationName(r.accompanist),
        status: r.status,
      };
    }),
    rabnm: ((rabnmRes.data ?? []) as unknown[]).map((row) => {
      const r = row as {
        id: string;
        type: string;
        detail: string | null;
        event_date: string | null;
        callings: unknown;
        sacrament_rabnm_people: { people: { name?: string } | null }[] | null;
      };
      return {
        id: r.id,
        type: r.type,
        calling_name: relationName(r.callings),
        detail: r.detail,
        event_date: r.event_date,
        people: (r.sacrament_rabnm_people ?? [])
          .map((p) => p.people?.name)
          .filter((name): name is string => Boolean(name)),
      };
    }),
  };
}
