import { getTodaysPublishedSacramentMeeting } from "@/lib/data/meetings";
import { getYouthActivities } from "@/lib/data/youth-activities";
import { getWardEvents } from "@/lib/data/ward-events";
import { getPublishedAnnouncements } from "@/lib/data/general-submissions";

export type CalendarItemKind = "sacrament" | "youth" | "ward" | "announcement";

export interface CalendarItem {
  /** ISO date, "yyyy-mm-dd" -- which day cell this item lands in. */
  date: string;
  time: string | null;
  title: string;
  kind: CalendarItemKind;
  cancelled: boolean;
  /** A short second line under the title -- a group name, a location,
   *  a cancellation note, or a recurrence phrase. */
  note: string | null;
  /** Only Sacrament Meeting links anywhere -- Youth Activities/Ward
   *  Events/Announcements have no single-item public page of their
   *  own to link to. */
  href: string | null;
}

/**
 * The public Ward Calendar View's own data (2026-11-01) -- merges the
 * same four sources the user named when scoping it: Sacrament Meetings,
 * Youth Activities, Ward Events, and dated Announcements, exactly the
 * same public-visibility rules each already has elsewhere in this app
 * (no new RLS, no new gate):
 *
 * - **Sacrament Meeting**: `getTodaysPublishedSacramentMeeting()` --
 *   the exact same function the landing page's own "This week" tile
 *   uses, so this can only ever show up on *today's* cell, and only
 *   once the public gate has opened (6 AM Mountain). No early reveal
 *   of a future Sunday, no lingering display of a past one -- matches
 *   the Vision workflow's own "public with no login, for that one day
 *   only" rule exactly, which is what "day-of only" meant when this
 *   scope was confirmed.
 * - **Youth Activities / Ward Events**: `getYouthActivities()`/
 *   `getWardEvents()`, unfiltered -- the same two calls /events
 *   already makes with no login gate; RLS on both tables already
 *   limits an anonymous visitor to `status = 'published'` rows (see
 *   each function's own comment), same as there.
 * - **Announcements**: `getPublishedAnnouncements()`, the same list
 *   `/announcements/public` shows, placed on its own `start_date`.
 *   **Known simplification**: a recurring announcement (migration 083)
 *   only renders once, on the series' own start date, labeled
 *   "Recurring" -- expanding its own cadence into every real occurrence
 *   on the calendar would be a genuinely separate feature (real
 *   occurrence generation, the same kind of work `/meeting-schedule`'s
 *   cadence engine already does elsewhere), not implied by what was
 *   asked for here.
 */
export async function getCalendarItems(): Promise<CalendarItem[]> {
  const [sacrament, youthActivities, wardEvents, announcements] = await Promise.all([
    getTodaysPublishedSacramentMeeting(),
    getYouthActivities(),
    getWardEvents(),
    getPublishedAnnouncements(),
  ]);

  const items: CalendarItem[] = [];

  if (sacrament) {
    items.push({
      date: sacrament.date,
      time: null,
      title: "Sacrament Meeting",
      kind: "sacrament",
      cancelled: false,
      note: null,
      href: `/meetings/${sacrament.id}/public`,
    });
  }

  for (const a of youthActivities) {
    items.push({
      date: a.activity_date,
      time: a.activity_time,
      title: a.title,
      kind: "youth",
      cancelled: a.cancelled,
      note: a.cancelled ? a.cancellation_note : a.group_name,
      href: null,
    });
  }

  for (const e of wardEvents) {
    items.push({
      date: e.event_date,
      time: e.event_time,
      title: e.title,
      kind: "ward",
      cancelled: false,
      note: e.location,
      href: null,
    });
  }

  for (const an of announcements) {
    if (!an.start_date) continue; // nothing to place on the grid
    items.push({
      date: an.start_date,
      time: an.start_time,
      title: an.title,
      kind: "announcement",
      cancelled: false,
      note: an.recurrence ? "Recurring" : null,
      href: null,
    });
  }

  return items;
}
