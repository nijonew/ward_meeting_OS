import { createClient } from "@/lib/supabase/server";
import { getWardEvents } from "@/lib/data/ward-events";
import { getPublishedAnnouncements } from "@/lib/data/general-submissions";
import { getYouthActivities, type YouthActivityRow } from "@/lib/data/youth-activities";
import { ACTIVITY_CLASSES, classesForCombinedGroup } from "@/lib/data/class-activities-shared";
import { getSessionUser } from "@/lib/supabase/get-session-user";

export type CalendarItemKind = "sacrament" | "ward" | "announcement" | "youth";

export interface CalendarItem {
  /** ISO date, "yyyy-mm-dd" -- which day cell this item lands in. */
  date: string;
  time: string | null;
  title: string;
  kind: CalendarItemKind;
  /** A short second line under the title -- a location, or a
   *  recurrence phrase. Sacrament Meeting's own cancellation reason
   *  is folded directly into `title` instead (see getCalendarItems'
   *  own comment), not carried here. */
  note: string | null;
  /** Only Sacrament Meeting links anywhere -- Ward Events/
   *  Announcements have no single-item public page of their own to
   *  link to. */
  href: string | null;
}

interface SacramentMeetingRow {
  id: string;
  date: string;
  cancelled: boolean;
  cancellation_note: string | null;
}

/**
 * Every Sacrament Meeting row (any date, any stage, cancelled or
 * not) -- a direct, lean query rather than going through
 * `lib/data/meetings.ts`'s full `Meeting` shape/`mapMeetingRow`,
 * since the calendar only ever needs these four columns. Unlike
 * `getTodaysPublishedSacramentMeeting`, this is NOT scoped to today
 * or to non-archived -- see getCalendarItems' own comment for why
 * that's fine here (showing that a Sunday HAD or WILL HAVE a
 * Sacrament Meeting is not the same as revealing its program).
 */
async function getAllSacramentMeetings(): Promise<SacramentMeetingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("id, date, cancelled, cancellation_note, meeting_types!inner(slug)")
    .eq("meeting_types.slug", "sacrament-meeting");
  if (error || !data) return [];
  return data as unknown as SacramentMeetingRow[];
}

/**
 * The public Ward Calendar View's own data (2026-11-01, reworked the
 * same day per the user's own follow-up):
 *
 * - **Sacrament Meeting -- every one, cancelled included, 2026-11-01**
 *   (the user's own request: "include all sacrament meetings
 *   including those that are cancelled" -- a reversal of this
 *   function's original "today only" scope). Showing that a given
 *   Sunday HAD or WILL HAVE a Sacrament Meeting is not the same as
 *   revealing that meeting's own program -- every ward holds one
 *   every week, that's not sensitive information on its own -- so
 *   this calendar fact is shown for any date, while the actual
 *   program (what clicking through to `/meetings/[id]/public` shows)
 *   still only opens on the real day, exactly as before; an archived
 *   or not-yet-public meeting's own page already shows a plain
 *   "isn't available right now" message rather than erroring, so
 *   linking every date here is safe regardless of whether that
 *   meeting's program is actually viewable yet.
 *
 *   **A cancelled one shows its own reason inline, not struck
 *   through** (the user's own request, same message: "rather than
 *   striking out items that are cancelled can we add '(No Sacrament
 *   Meeting due to...)' after the name of the meeting and then
 *   include the reason for cancellation?") -- `title` itself becomes
 *   "Sacrament Meeting (No Sacrament Meeting due to `<reason>`)",
 *   composed here rather than in the page's own render layer, so the
 *   calendar page doesn't need any cancelled-specific styling at all.
 *   Falls back to "(No Sacrament Meeting)" with no reason clause for
 *   the rare case of a cancellation recorded with no note.
 *
 * - **Youth Activities, logged-in only, 2026-11-04** -- removed
 *   entirely on 2026-11-01 ("lets hold off on including the youth
 *   activities for now"), then re-added with a login gate the user's
 *   own words asked for directly: "I would like for the calendar to
 *   not show youth activities unless someone is logged in. If someone
 *   is logged in I want those shown." Gated on plain sign-in (any
 *   account, `getSessionUser()`'s own `user`), not on a specific
 *   feature/role -- matches the user's own literal "someone is logged
 *   in," and this calendar has no other per-item role gating to be
 *   consistent with. See `buildYouthActivityItems`'s own comment for
 *   how each one is titled and how a ward-wide cancellation collapses.
 * - **Ward Events**: `getWardEvents()`, unfiltered -- the same call
 *   `/events` already makes with no login gate; RLS already limits
 *   an anonymous visitor to `status = 'published'` rows (see that
 *   function's own comment).
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
/**
 * "Can we put the group name in front of the activity title? And if
 * the activity is cancelled for all youth can we just put 'Youth
 * Activities Cancelled due to (reason)' rather than a line for each
 * group?" (the user's own request, 2026-11-04).
 *
 * Groups the raw rows by date first, since the "all youth" check needs
 * to see every row for a day at once, not one row at a time:
 * - Expands each row's own `group_name` to the real class(es) it
 *   actually covers (`classesForCombinedGroup` -- a Combined pseudo-
 *   group covers several classes in one row; an individual class
 *   covers only itself) and unions every CANCELLED row's own coverage
 *   into one set for the day.
 * - If that set covers every one of the 6 real classes
 *   (`ACTIVITY_CLASSES`) -- whether that took one shared Combined row
 *   cancelled outright, or several individual/partial rows adding up
 *   to the same thing -- the whole day collapses into one item,
 *   "Youth Activities Cancelled due to `<reason>`" (every distinct
 *   reason among those rows, joined, for the rare case two different
 *   cancellations together add up to "everyone"), replacing every
 *   per-row line for that date.
 * - Otherwise, each row renders on its own line, titled
 *   "`<group_name>`: `<title>`" -- a cancelled one keeps the existing
 *   "(Cancelled due to `<reason>`)" suffix, since cancellation isn't
 *   total for this date and still needs a day-of-week-sized line here
 *   rather than this function's own collapsed summary.
 */
function buildYouthActivityItems(youthActivities: YouthActivityRow[]): CalendarItem[] {
  const byDate = new Map<string, YouthActivityRow[]>();
  for (const a of youthActivities) {
    const list = byDate.get(a.activity_date) ?? [];
    list.push(a);
    byDate.set(a.activity_date, list);
  }

  const items: CalendarItem[] = [];
  for (const [date, rows] of byDate) {
    const cancelledClasses = new Set<string>();
    for (const r of rows) {
      if (!r.cancelled) continue;
      for (const cls of classesForCombinedGroup(r.group_name) ?? [r.group_name]) {
        cancelledClasses.add(cls);
      }
    }

    if (ACTIVITY_CLASSES.every((cls) => cancelledClasses.has(cls))) {
      const reasons = Array.from(
        new Set(rows.filter((r) => r.cancelled && r.cancellation_note).map((r) => r.cancellation_note as string))
      );
      items.push({
        date,
        time: null,
        title: `Youth Activities Cancelled${reasons.length > 0 ? ` due to ${reasons.join("; ")}` : ""}`,
        kind: "youth",
        note: null,
        href: null,
      });
      continue;
    }

    for (const r of rows) {
      const title = r.cancelled
        ? `${r.group_name}: ${r.title} (Cancelled${r.cancellation_note ? ` due to ${r.cancellation_note}` : ""})`
        : `${r.group_name}: ${r.title}`;
      items.push({ date, time: r.activity_time, title, kind: "youth", note: r.group_name, href: null });
    }
  }

  return items;
}

export async function getCalendarItems(): Promise<CalendarItem[]> {
  const { user } = await getSessionUser();

  const [sacramentMeetings, wardEvents, announcements, youthActivities] = await Promise.all([
    getAllSacramentMeetings(),
    getWardEvents(),
    getPublishedAnnouncements(),
    user ? getYouthActivities() : Promise.resolve([]),
  ]);

  const items: CalendarItem[] = [];

  for (const meeting of sacramentMeetings) {
    const title = meeting.cancelled
      ? `Sacrament Meeting (No Sacrament Meeting${meeting.cancellation_note ? ` due to ${meeting.cancellation_note}` : ""})`
      : "Sacrament Meeting";
    items.push({
      date: meeting.date,
      time: null,
      title,
      kind: "sacrament",
      note: null,
      href: `/meetings/${meeting.id}/public`,
    });
  }

  for (const e of wardEvents) {
    items.push({
      date: e.event_date,
      time: e.event_time,
      title: e.title,
      kind: "ward",
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
      note: an.recurrence ? "Recurring" : null,
      href: null,
    });
  }

  items.push(...buildYouthActivityItems(youthActivities));

  return items;
}
