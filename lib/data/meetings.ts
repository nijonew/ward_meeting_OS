import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { applyRotationsToNewMeeting } from "@/lib/data/rotations";
import { seedPlannedElementsForMeeting } from "@/lib/data/meeting-elements";
import { sweepMeetingCancellations } from "@/lib/data/meeting-cancellations";
import { autoGenerateUpcomingMeetings } from "@/lib/data/meeting-schedule";
import { getMountainTimeNow } from "@/lib/data/timezone";
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
 *
 * **Performance fix, 2026-10-07** (the user's own report: "the app is
 * extremely slow"): this used to check each past meeting against 9
 * tables one at a time, sequentially -- up to 9 round trips per
 * meeting, times however many past meetings hadn't been archived yet,
 * on every single /dashboard or /calling-planning load. A meeting with
 * genuinely no activity never got skipped on a later run either -- it
 * was rechecked from scratch every time, forever, so this only got
 * worse as more unarchived meetings piled up. Migration `062`'s
 * `meetings_with_real_activity` Postgres function does the same "does
 * any of these 9 tables have a row for this meeting" check entirely in
 * the database, for every candidate meeting at once -- down to exactly
 * 3 round trips total (fetch candidates, one RPC call, one bulk
 * update), regardless of how many past meetings exist.
 */
async function autoArchivePastMeetings(): Promise<Set<string>> {
  const supabase = await createClient();
  // Mountain Time, not the server's own UTC clock (2026-10-20 bugfix,
  // the user's own report: "my bishopric meeting for tonight is
  // already archived"). The server (Vercel) runs in UTC, which rolls
  // over to the next calendar day 6-7 hours before midnight actually
  // arrives in Mountain Time -- so for several hours every evening, a
  // meeting scheduled for *today* (Mountain) was being treated as
  // already in the past and auto-archived before it had even
  // happened. Same root cause, same fix, as `getMountainTimeNow`'s own
  // doc comment already describes for the Sacrament Meeting public
  // page -- just never applied here too.
  const { dateIso: todayIso } = getMountainTimeNow();

  const { data: pastMeetings } = await supabase
    .from("meetings")
    .select("id, cancelled")
    .lt("date", todayIso)
    .neq("stage", "archived");

  const noActivityIds = new Set<string>();
  if (!pastMeetings || pastMeetings.length === 0) return noActivityIds;

  const candidates = pastMeetings as { id: string; cancelled: boolean | null }[];
  const { data: activityRows } = await supabase.rpc("meetings_with_real_activity", {
    p_meeting_ids: candidates.map((m) => m.id),
  });
  const hasActivity = new Set(((activityRows ?? []) as { meeting_id: string }[]).map((r) => r.meeting_id));

  const toArchive: string[] = [];
  for (const m of candidates) {
    if (m.cancelled || hasActivity.has(m.id)) {
      toArchive.push(m.id);
    } else {
      noActivityIds.add(m.id);
    }
  }

  if (toArchive.length > 0) {
    await supabase.from("meetings").update({ stage: "archived" }).in("id", toArchive);
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
  //
  // autoGenerateUpcomingMeetings only ever creates present/future
  // meetings (generateMeetingsFromRules refuses a through-date in the
  // past) -- it can't interact with the archive sweep's own past-only
  // scope either way, but runs here, lazily on every call, so routine
  // meetings configured in /meeting-schedule's own cadence rules just
  // keep existing without anyone needing to visit that page and click
  // "Generate Meetings" (see that function's own comment for the
  // user's request behind this).
  await sweepMeetingCancellations();
  await autoGenerateUpcomingMeetings();
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
 *
 * "Today" is Mountain Time, not the server's own UTC clock, and this
 * only returns a meeting from 6 AM Mountain onward (2026-10-11 bugfix,
 * matching the identical fix in app/meetings/[id]/public/page.tsx's
 * own gate -- see isSacramentMeetingPubliclyVisible's comment for why:
 * a plain UTC date comparison here made this landing-page tile point
 * at the *next* day's meeting several hours before it actually arrived
 * in Mountain Time).
 */
export async function getTodaysPublishedSacramentMeeting(): Promise<Meeting | null> {
  const { dateIso, hour } = getMountainTimeNow();
  if (hour < 6) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_SELECT_COLUMNS)
    .eq("date", dateIso)
    .neq("stage", "archived");

  if (error || !data) {
    return null;
  }

  const meetings = data.map(mapMeetingRow);
  return meetings.find((m) => m.meetingType === "sacrament-meeting") ?? null;
}

/**
 * The nearest upcoming (today or later), non-cancelled, non-archived
 * Sacrament Meeting -- backs the landing page's prominent "This week"
 * tile's early-access case, added 2026-10-24.
 *
 * **Bug found and fixed, 2026-10-24**: the user's own report --
 * granting a calling `sacrament_program_view` "has been granted, but
 * it seems to have been disabled as a whole." Root cause: that
 * feature had only ever been wired into a second, separate tile
 * ("Sacrament Meeting Programs," plural, deep in the Administration
 * section, linking to `/dashboard?type=sacrament-meeting&readonly=1`).
 * The prominent "This week" tile everyone actually looks at (singular
 * "Sacrament Meeting Program") only ever called
 * `getTodaysPublishedSacramentMeeting` above -- strictly today-only,
 * with zero awareness of the viewer's own features -- so granting the
 * feature never visibly did anything from that tile's point of view,
 * which is exactly what "disabled as a whole" looks like from the
 * outside. This gives that same tile a second path for when there's
 * no meeting *today* yet.
 *
 * **No longer filtered by `ready_for_public`, 2026-10-27** -- the
 * user's own clarification of what this tile should actually do:
 * "someone who is given this access [should] have a view of the
 * upcoming two sundays... even if the check box is not checked."
 * `/meetings/[id]/public`'s own gate now allows the nearest two
 * Sacrament Meetings unconditionally for `sacrament_program_view`
 * (see `getNextTwoSacramentMeetingIds`) -- the nearest meeting this
 * function returns is always one of those two, so there's no reason
 * left for this specific function to also require the flag. A meeting
 * further out that an admin has deliberately flagged `ready_for_public`
 * is still reachable (and still viewable) via the plural "Sacrament
 * Meeting Programs" tile's own dashboard listing -- that flag's own
 * effect on the destination page is unchanged, only this tile-picking
 * function stopped checking it.
 */
export async function getEarlyAccessSacramentMeeting(): Promise<Meeting | null> {
  const { dateIso } = getMountainTimeNow();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_SELECT_COLUMNS)
    .gte("date", dateIso)
    .eq("cancelled", false)
    .neq("stage", "archived")
    .order("date", { ascending: true });

  if (error || !data) return null;

  for (const row of data) {
    const meetingType = Array.isArray(row.meeting_types) ? row.meeting_types[0] : row.meeting_types;
    if (meetingType?.slug !== "sacrament-meeting") continue;
    return mapMeetingRow(row);
  }
  return null;
}

/**
 * The ids of the two nearest upcoming (today or later), non-cancelled,
 * non-archived Sacrament Meetings -- a second, unconditional path into
 * `/meetings/[id]/public` for `sacrament_program_view`, alongside the
 * existing `ready_for_public` flag (2026-10-27, the user's own words,
 * clarifying the early-access tile fix above wasn't quite what they
 * meant): "I would like for someone who is given this access to have
 * a view of the upcoming two sundays current public (non-planning)
 * view even if the check box is not checked for public viewing...
 * this is an in-between type of access to allow someone to prepare a
 * printed program." Deliberately additive -- `ready_for_public` still
 * works too, for a meeting further out an admin wants to flag early;
 * this just means the nearest two never need that flag at all.
 *
 * "Next two" is a fixed count, not a 14-day window (confirmed with
 * the user) -- a gap like General/Stake Conference pushes the real
 * second Sunday further out, and the count still means exactly two
 * real Sacrament Meetings, not however many happen to fall in a date
 * range.
 */
export async function getNextTwoSacramentMeetingIds(): Promise<Set<string>> {
  const { dateIso } = getMountainTimeNow();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meetings")
    .select("id, meeting_types(slug)")
    .gte("date", dateIso)
    .eq("cancelled", false)
    .neq("stage", "archived")
    .order("date", { ascending: true });

  if (error || !data) return new Set();

  type Row = { id: string; meeting_types: { slug?: string }[] | { slug?: string } | null };
  const ids: string[] = [];
  for (const row of data as unknown as Row[]) {
    const meetingType = Array.isArray(row.meeting_types) ? row.meeting_types[0] : row.meeting_types;
    if (meetingType?.slug !== "sacrament-meeting") continue;
    ids.push(row.id);
    if (ids.length === 2) break;
  }
  return new Set(ids);
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
 *
 * **Bug found and fixed 2026-10-16** (the user's own report: a foreign
 * key violation on `sacrament_announcement_pulls_planned_element_id_fkey`
 * trying to pull a previously-used announcement into a meeting): unlike
 * `/meetings/new`'s own `createMeeting` action and Generate Meetings
 * (`lib/data/meeting-schedule.ts`), this function never called
 * `seedPlannedElementsForMeeting` -- a meeting created this way (e.g.
 * via Table Admin's `createIfMissing` calendar picker) got zero
 * `meeting_planned_elements` rows, so its Planning page always fell
 * back to the shared, read-only `meeting_templates` list -- whose own
 * row ids are `meeting_templates.id`, not a real per-meeting
 * `meeting_planned_elements.id`. Pulling an announcement into one of
 * those fallback rows then tried to insert that non-existent id as
 * `planned_element_id`, violating the FK. `special_format` defaults to
 * `"standard"` for Sacrament Meeting (there's no format to know yet at
 * this generic creation point), matching Generate Meetings' own
 * identical default for the same reason.
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
  await seedPlannedElementsForMeeting(
    created.id as string,
    meetingType.id as string,
    meetingTypeSlug === "sacrament-meeting" ? "standard" : null
  );

  cache?.set(dateIso, created.id as string);
  return created.id as string;
}

/**
 * Wrapped in React's `cache()` (2026-10-04, found alongside
 * getSessionUser's own identical fix while chasing a "very very slow
 * to load" report) -- every meeting page's shared layout
 * (app/meetings/[id]/layout.tsx) fetches this same meeting by the same
 * id, and the page rendered inside it (Planning, Public, etc.) fetches
 * it again independently -- `cache()` collapses repeat calls with the
 * same `id` within one request into a single query.
 */
export const getMeetingById = cache(async (id: string): Promise<Meeting | null> => {
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
});