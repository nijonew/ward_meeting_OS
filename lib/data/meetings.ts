import { createClient } from "@/lib/supabase/server";
import { applyRotationsToNewMeeting } from "@/lib/data/rotations";
import { sweepMeetingCancellations } from "@/lib/data/meeting-cancellations";
import type { Meeting, MeetingLifecycleStage, MeetingType, MeetingTypeSlug } from "@/lib/types";

// NOTE: no generated Database types are wired up yet (would need the
// Supabase CLI), so these queries are loosely typed at the client level.
// The functions below map raw rows into the app's existing Meeting /
// MeetingType shapes so nothing downstream (LifecycleBadge, dashboard
// rendering, etc.) has to change.

export async function getMeetingTypes(): Promise<MeetingType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("meeting_types").select("slug, name").order("name");

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    slug: row.slug as MeetingTypeSlug,
    name: row.name as string,
    // Was stale: only Sacrament/Bishopric Meeting were ever true here,
    // but Ward Council and Youth Council have had full Template/
    // Planning/Live/Archived support for a while now (both branch
    // through as "isCouncil" throughout those pages) -- left at false
    // this whole time, every dashboard row for those two types showed
    // as a non-clickable "Coming soon" regardless of role. Fixed
    // 2026-09-08 while wiring the calling-based non-admin viewer, which
    // depends on these rows actually being clickable.
    isBuilt: true,
  }));
}

const MEETING_SELECT_COLUMNS =
  "id, date, stage, time_of_day, duration_minutes, cancelled, cancellation_note, meeting_types(slug, name)";

function mapMeetingRow(row: {
  id: string;
  date: string;
  stage: string;
  time_of_day: string | null;
  duration_minutes: number | null;
  cancelled?: boolean | null;
  cancellation_note?: string | null;
  meeting_types: { slug: string; name: string }[] | { slug: string; name: string } | null;
}): Meeting {
  const meetingType = Array.isArray(row.meeting_types) ? row.meeting_types[0] : row.meeting_types;

  return {
    id: row.id,
    meetingType: (meetingType?.slug ?? "sacrament-meeting") as MeetingTypeSlug,
    title: meetingType?.name ?? "Meeting",
    date: row.date,
    stage: row.stage as MeetingLifecycleStage,
    timeOfDay: row.time_of_day,
    durationMinutes: row.duration_minutes,
    cancelled: row.cancelled ?? false,
    cancellationNote: row.cancellation_note ?? null,
  };
}

/**
 * Tables that only ever gain a row for a given meeting_id through real
 * human action -- never auto-seeded at meeting-creation time. Used by
 * the auto-archive sweep below to tell "nothing happened here yet"
 * apart from "the meeting was actually run."
 *
 * Deliberately EXCLUDES sacrament_assignments/bishopric_assignments and
 * sacrament_planning: applyRotationsToNewMeeting/applyFixedSacramentRoles
 * (lib/data/rotations.ts) write rotation-assigned roles (Presiding,
 * Conducting, Chorister, Organist, prayers, etc.) into the assignments
 * tables the moment a meeting is *created*, and app/meetings/new/actions.ts
 * inserts a sacrament_planning row at creation too -- so those tables
 * having rows proves nothing about whether anyone actually did anything
 * with the meeting. meeting_planned_elements is excluded for the same
 * reason (seeded from the template at creation, migration 033).
 */
const REAL_ACTIVITY_TABLES = [
  "meeting_element_notes",
  "sacrament_music",
  "sacrament_speakers_adults",
  "sacrament_speakers_youth",
  "sacrament_rabnm",
  "agenda_items",
  "meeting_action_items",
  "council_notes",
  "bishopric_minutes",
] as const;

async function meetingHasRealActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  meetingId: string
): Promise<boolean> {
  for (const table of REAL_ACTIVITY_TABLES) {
    const { data } = await supabase.from(table).select("meeting_id").eq("meeting_id", meetingId).limit(1);
    if (data && data.length > 0) return true;
  }
  return false;
}

/**
 * No scheduled-job infrastructure exists in this app (no Vercel Cron /
 * Supabase pg_cron wired up), so "automatic at end of day" is
 * implemented as a lazy sweep run on every dashboard load instead --
 * eventually consistent (archives on the next page view after the
 * meeting's date passes) rather than exactly at midnight, which is
 * fine for a ward planning tool nobody is watching in real time.
 *
 * A meeting whose date has passed either gets archived (if real
 * activity was recorded, or if it was cancelled -- being cancelled
 * already explains why nothing was entered) or is left as-is and
 * reported back as "no activity" so the dashboard can badge it
 * distinctly from a meeting that was actually run, per the
 * "Auto-archive past meetings" open item in PROJECT_CONTEXT.md.
 */
async function autoArchivePastMeetings(): Promise<Set<string>> {
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: pastMeetings } = await supabase
    .from("meetings")
    .select("id, cancelled")
    .lt("date", todayIso)
    .neq("stage", "archived");

  const noActivityIds = new Set<string>();
  if (!pastMeetings) return noActivityIds;

  for (const m of pastMeetings as { id: string; cancelled: boolean | null }[]) {
    const shouldArchive = m.cancelled || (await meetingHasRealActivity(supabase, m.id));
    if (shouldArchive) {
      await supabase.from("meetings").update({ stage: "archived" }).eq("id", m.id);
    } else {
      noActivityIds.add(m.id);
    }
  }

  return noActivityIds;
}

export async function getUpcomingMeetings(): Promise<Meeting[]> {
  // Order matters: a meeting inside a cancelled window (see
  // meeting_cancellations) should already be marked cancelled before
  // the archive sweep decides whether it "had real activity" -- a
  // cancelled meeting auto-archives regardless (see
  // autoArchivePastMeetings), so cancelling first avoids a one-render
  // lag where it briefly shows as "No Activity" instead.
  await sweepMeetingCancellations();
  const noActivityIds = await autoArchivePastMeetings();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_SELECT_COLUMNS)
    .order("date", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({ ...mapMeetingRow(row), noActivity: noActivityIds.has(row.id) }));
}

export async function getUpcomingMeeting(): Promise<Meeting | null> {
  const meetings = await getUpcomingMeetings();
  return meetings.find((m) => m.meetingType === "sacrament-meeting") ?? meetings[0] ?? null;
}

/**
 * The sacrament meeting the public landing page should link to today, if
 * any. Ward business and announcements made live during conducting are
 * intentionally not part of this view; they're folded in only once the
 * meeting is archived.
 *
 * Only returns a meeting dated today -- the tile should not appear (or
 * should say "nothing published yet") on any other day.
 *
 * Gated on date + not-archived, not a `ready`/`live` stage (2026-09-10,
 * the user's own request: "we can remove the review, ready, live
 * statuses for sacrament meeting") -- those stages were never actually
 * reachable in the first place: `meetings.stage` is deliberately kept
 * out of Table Admin, and no dedicated "mark ready"/"go live" action
 * was ever built for Sacrament Meeting, so this query could never have
 * matched anything in real production data. The Vision workflow's own
 * rule was already date-based ("the public with no login, for that one
 * day only... editable at all times until archived"), so this is really
 * a bugfix as much as a simplification: today + not archived is the
 * actual, working rule.
 */
export async function getTodaysPublishedSacramentMeeting(): Promise<Meeting | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_SELECT_COLUMNS)
    .eq("date", today)
    .neq("stage", "archived");

  if (error || !data) {
    return null;
  }

  const meetings = data.map(mapMeetingRow);
  return meetings.find((m) => m.meetingType === "sacrament-meeting") ?? null;
}

/**
 * Finds the meeting of a given type on a given date, or creates one
 * (stage 'template', rotations applied same as any other meeting
 * creation path) if it doesn't exist yet -- so planning can happen
 * against a future date well before that meeting is otherwise touched,
 * matching the old spreadsheet workflow of listing Sundays out in
 * advance rather than requiring each one to be individually created
 * first. Pass `cache` when resolving many dates in one call (e.g. a bulk
 * import) to avoid a repeat lookup/insert for the same date.
 */
export async function getOrCreateMeetingId(
  dateIso: string,
  meetingTypeSlug: MeetingTypeSlug,
  cache?: Map<string, string>
): Promise<string | null> {
  if (cache?.has(dateIso)) {
    return cache.get(dateIso)!;
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("meetings")
    .select("id, meeting_types!inner(slug)")
    .eq("date", dateIso)
    .eq("meeting_types.slug", meetingTypeSlug)
    .maybeSingle();

  if (existing) {
    cache?.set(dateIso, existing.id as string);
    return existing.id as string;
  }

  const { data: meetingType } = await supabase.from("meeting_types").select("id").eq("slug", meetingTypeSlug).single();
  if (!meetingType) return null;

  const { data: created, error } = await supabase
    .from("meetings")
    .insert({ meeting_type_id: meetingType.id, date: dateIso, stage: "template" })
    .select("id")
    .single();
  if (error || !created) return null;

  await applyRotationsToNewMeeting(created.id as string, meetingType.id as string, meetingTypeSlug);

  cache?.set(dateIso, created.id as string);
  return created.id as string;
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_SELECT_COLUMNS)
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return mapMeetingRow(data);
}