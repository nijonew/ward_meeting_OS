import { createClient } from "@/lib/supabase/server";
import { sweepPastAnnouncements, compareAnnouncementsBySchedule } from "@/lib/data/announcements";
import {
  ANNOUNCEMENT_WHERE,
  MEETING_TYPE_ANNOUNCEMENT_LABEL,
  parseMultiSelectValue,
} from "@/lib/data/announcement-constants";
import type { MeetingTypeSlug } from "@/lib/types";

export interface ReviewAnnouncement {
  id: string;
  title: string;
}

export interface PreviousMeetingMinutes {
  date: string;
  text: string;
}

type CollaborativeMeetingTypeSlug = "bishopric-meeting" | "ward-council" | "youth-council";

function isCollaborativeType(slug: MeetingTypeSlug): slug is CollaborativeMeetingTypeSlug {
  return slug === "bishopric-meeting" || slug === "ward-council" || slug === "youth-council";
}

/**
 * Whether a comma-joined `where_announced` value includes `label` --
 * now a thin wrapper over the shared `parseMultiSelectValue`
 * (`lib/data/announcement-constants.ts`, extracted 2026-11-14 once
 * `getCalendarItems` needed the identical check for the new "Calendar"
 * checkbox) rather than its own hand-rolled copy of the same
 * ordered-prefix-matching logic.
 */
function whereAnnouncedIncludes(raw: string | null, label: string, allValues: readonly string[]): boolean {
  return parseMultiSelectValue(raw, allValues).includes(label);
}

/**
 * Review section content #1 (2026-10-19, the user's own design): an
 * announcement shows up in a collaborative meeting's Review section
 * automatically whenever this meeting type's own label is checked in
 * the announcement's "Where should this be announced?" field -- no
 * pull/consume mechanism, no join table, unlike Sacrament Meeting's own
 * Announcements block (lib/data/sacrament-announcements.ts), which is a
 * genuinely different, explicit-pull design. Read-only everywhere it
 * renders.
 *
 * **Sorted soonest-to-latest by event date, 2026-10-25** (the user's
 * own request: "I would like for the sort we discussed for
 * announcements to also apply to the order in which they appear in
 * meetings") -- was `created_at DESC` (newest-submitted first), the
 * exact same disconnected-from-the-actual-event-date sort the public
 * page itself had before `compareAnnouncementsBySchedule` was built
 * for it. `start_date`/`start_time` are fetched only to sort by --
 * the `review_announcements` row kind (lib/data/agenda-rows.ts)
 * doesn't display a schedule line, so they're dropped again before
 * returning.
 *
 * **Title only, not the full announcement, 2026-11-01** (the user's
 * own request, same message as the public-page exclusion fix: "also
 * in non-sacrament meetings I only want the announcement title rather
 * than the whole announcement") -- `body` is no longer selected or
 * returned at all; a council reviewing this section sees just the
 * title of each announcement that named its meeting type, same as a
 * quick agenda line, not the full text. The full announcement is
 * still one click away on `/announcements/public`.
 *
 * **Drag-reorderable, 2026-11-22** (migration 110, the user's own
 * request: "Same with announcements" -- same ask as Agenda Items'
 * own new drag handle). Membership is still decided purely by
 * `where_announced`, same as always -- this only adds a per-meeting
 * DISPLAY order on top, via `collaborative_announcement_order`, a
 * table with no membership concept of its own. Every currently-matched
 * announcement that doesn't already have an order row for this
 * meeting gets one lazily materialized here, in the existing schedule
 * order, so a page that's never been reordered still looks exactly
 * the same as before this shipped -- from then on, `setReviewAnnouncementOrder`
 * (app/meetings/[id]/bishopric-actions.ts) just rewrites these rows'
 * own `sort_order`. `onConflict`/`ignoreDuplicates` guards the one real
 * race this lazy-insert can hit: two people opening the same meeting's
 * Planning page for the first time at once, both computing the same
 * "needs a row" set.
 */
export async function getAnnouncementsForMeetingReview(
  meetingId: string,
  meetingType: MeetingTypeSlug
): Promise<ReviewAnnouncement[]> {
  if (!isCollaborativeType(meetingType)) return [];
  const label = MEETING_TYPE_ANNOUNCEMENT_LABEL[meetingType];

  await sweepPastAnnouncements();
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, title, where_announced, start_date, start_time")
    .eq("status", "published");

  const matched = ((data ?? []) as {
    id: string;
    title: string;
    where_announced: string | null;
    start_date: string | null;
    start_time: string | null;
  }[])
    .filter((row) => whereAnnouncedIncludes(row.where_announced, label, ANNOUNCEMENT_WHERE))
    .sort(compareAnnouncementsBySchedule);

  if (matched.length === 0) return [];

  const { data: orderRows } = await supabase
    .from("collaborative_announcement_order")
    .select("announcement_id, sort_order")
    .eq("meeting_id", meetingId);

  const orderByAnnouncementId = new Map(
    ((orderRows ?? []) as { announcement_id: string; sort_order: number }[]).map((r) => [r.announcement_id, r.sort_order])
  );

  let nextOrder = Math.max(0, ...Array.from(orderByAnnouncementId.values())) + 10;
  const toInsert: { meeting_id: string; announcement_id: string; sort_order: number }[] = [];
  for (const row of matched) {
    if (orderByAnnouncementId.has(row.id)) continue;
    orderByAnnouncementId.set(row.id, nextOrder);
    toInsert.push({ meeting_id: meetingId, announcement_id: row.id, sort_order: nextOrder });
    nextOrder += 10;
  }

  if (toInsert.length > 0) {
    await supabase
      .from("collaborative_announcement_order")
      .upsert(toInsert, { onConflict: "meeting_id,announcement_id", ignoreDuplicates: true });
  }

  return matched
    .slice()
    .sort((a, b) => (orderByAnnouncementId.get(a.id) ?? 0) - (orderByAnnouncementId.get(b.id) ?? 0))
    .map((row) => ({ id: row.id, title: row.title }));
}

/**
 * Review section content #2: just the general Minutes summary from the
 * most recent earlier meeting of the same type (the user's own
 * confirmation: "Just the general Minutes summary," not a deeper
 * breakdown). Bishopric Meeting reads `bishopric_minutes.minutes_body`;
 * Ward Council/Youth Council read `council_notes.notes` -- both are
 * the same "General Minutes"/"Notes" field BishopricMinutesForm/
 * CouncilNotesForm already save. Read-only here regardless.
 */
export async function getPreviousMeetingMinutes(
  meetingType: MeetingTypeSlug,
  beforeDateIso: string
): Promise<PreviousMeetingMinutes | null> {
  if (!isCollaborativeType(meetingType)) return null;
  const supabase = await createClient();

  const { data: meetingRow } = await supabase
    .from("meetings")
    .select("id, date, meeting_type_id, meeting_types!inner(slug)")
    .eq("meeting_types.slug", meetingType)
    .lt("date", beforeDateIso)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!meetingRow) return null;

  if (meetingType === "bishopric-meeting") {
    const { data } = await supabase
      .from("bishopric_minutes")
      .select("minutes_body")
      .eq("meeting_id", meetingRow.id)
      .maybeSingle();
    if (!data?.minutes_body) return null;
    return { date: meetingRow.date, text: data.minutes_body };
  }

  const { data } = await supabase
    .from("council_notes")
    .select("notes")
    .eq("meeting_id", meetingRow.id)
    .maybeSingle();
  if (!data?.notes) return null;
  return { date: meetingRow.date, text: data.notes };
}
