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
  cancellation_note: string | null;
}

/**
 * Only a CANCELLED Sacrament Meeting row -- any date, any stage -- a
 * direct, lean query rather than going through `lib/data/meetings.ts`'s
 * full `Meeting` shape/`mapMeetingRow`, since the calendar only ever
 * needs these three columns.
 *
 * **Narrowed to cancelled-only, 2026-11-04** (the user's own request:
 * "on the calendar, only show sacrament meeting if it is cancelled") --
 * a direct reversal of the "show every one, cancelled included"
 * decision from minutes earlier the same day. Every ward holds a
 * Sacrament Meeting every single week, so showing one on every Sunday
 * regardless of status was mostly just noise; a CANCELLED one is the
 * actual exception worth calling out on a calendar. `.eq("cancelled",
 * true)` is applied right in the query, not filtered in JS after the
 * fact, since there's no reason left to fetch the ordinary rows at
 * all.
 */
async function getCancelledSacramentMeetings(): Promise<SacramentMeetingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("id, date, cancellation_note, meeting_types!inner(slug)")
    .eq("meeting_types.slug", "sacrament-meeting")
    .eq("cancelled", true);
  if (error || !data) return [];
  return data as unknown as SacramentMeetingRow[];
}

/**
 * The public Ward Calendar View's own data (2026-11-01, reworked the
 * same day per the user's own follow-up):
 *
 * - **Sacrament Meeting -- cancelled only, 2026-11-04** -- originally
 *   every one, cancelled included (2026-11-01: "include all sacrament
 *   meetings including those that are cancelled"), narrowed the same
 *   way minutes later this same day per the user's own follow-up:
 *   "only show sacrament meeting if it is cancelled." Every ward holds
 *   one every single week, so showing it on every Sunday regardless of
 *   status was mostly noise -- a cancelled one is the real exception
 *   worth a calendar line. `getCancelledSacramentMeetings` filters to
 *   `cancelled = true` right in the query. Still links to
 *   `/meetings/[id]/public`, same as before -- that page already
 *   shows its own "cancelled for `<reason>`" message rather than
 *   erroring.
 *
 *   Shows its own reason inline, not struck through (the user's own
 *   original request: "rather than striking out items that are
 *   cancelled can we add '(No Sacrament Meeting due to...)' after the
 *   name of the meeting and then include the reason for
 *   cancellation?") -- `title` is "Sacrament Meeting (No Sacrament
 *   Meeting due to `<reason>`)", composed here rather than in the
 *   page's own render layer, so the calendar page doesn't need any
 *   cancelled-specific styling at all. Falls back to "(No Sacrament
 *   Meeting)" with no reason clause for the rare case of a
 *   cancellation recorded with no note.
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
 *
 * **Plain, un-cancelled "TBD" placeholders don't show here at all,
 * 2026-11-04** -- `fillYouthActivityPlaceholders`
 * (`lib/data/youth-activity-schedule.ts`) now stamps a "TBD" row for
 * every class with nothing covering it, every week, rolling ~3 months
 * out, specifically so the management grids always have something to
 * fill in rather than a blank line. That's genuinely useful on those
 * pages; on a shared calendar it would just be a wall of "`<class>`:
 * TBD" lines for everything nobody's decided yet, which isn't
 * information worth showing someone browsing what's actually
 * happening. A TBD row that's since been CANCELLED still counts --
 * cancelling something, even an unplanned placeholder, is a real fact
 * worth showing (and still feeds the "cancelled for all youth" check
 * above).
 *
 * **An individual class row is suppressed once a Combined row already
 * covers that same class on the same date, 2026-11-04** (the user's
 * own report: a Combined YW week showed both "Combined YW: `<title>`"
 * AND the same title again for each of the 3 YW classes individually
 * -- "I want it listed once for the YW... and not individually and
 * collectively"). Root cause isn't a calendar bug alone -- it's a real
 * side effect of this app's own established overwrite behavior
 * (`overwriteClassesFromCombined`, `app/youth-activities/actions.ts`):
 * creating or editing a Combined activity stamps a real copy of it
 * onto every class it covers, on purpose, so each class's own
 * management grid has something to see/edit -- meaning the shared
 * Combined row and its per-class copies genuinely both exist in the
 * table at once. That's correct and necessary for the management
 * grids; it's only a problem here, where the calendar was blindly
 * showing every raw row as its own line. Fixed by always preferring
 * the Combined line for a class the Combined row already covers,
 * matching this app's own Combined-outranks-individual priority model
 * -- regardless of whether the individual copy's own content still
 * matches it exactly, so this can't quietly stop working the moment
 * someone edits one side without the other.
 */
function buildYouthActivityItems(rawYouthActivities: YouthActivityRow[]): CalendarItem[] {
  const youthActivities = rawYouthActivities.filter((a) => a.cancelled || a.title !== "TBD");
  const byDate = new Map<string, YouthActivityRow[]>();
  for (const a of youthActivities) {
    const list = byDate.get(a.activity_date) ?? [];
    list.push(a);
    byDate.set(a.activity_date, list);
  }

  const items: CalendarItem[] = [];
  for (const [date, allRows] of byDate) {
    const cancelledClasses = new Set<string>();
    for (const r of allRows) {
      if (!r.cancelled) continue;
      for (const cls of classesForCombinedGroup(r.group_name) ?? [r.group_name]) {
        cancelledClasses.add(cls);
      }
    }

    if (ACTIVITY_CLASSES.every((cls) => cancelledClasses.has(cls))) {
      const reasons = Array.from(
        new Set(allRows.filter((r) => r.cancelled && r.cancellation_note).map((r) => r.cancellation_note as string))
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

    const combinedCoveredClasses = new Set<string>();
    for (const r of allRows) {
      const covered = classesForCombinedGroup(r.group_name);
      if (covered) for (const cls of covered) combinedCoveredClasses.add(cls);
    }
    const rows = allRows.filter((r) => !combinedCoveredClasses.has(r.group_name));

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

  const [cancelledSacramentMeetings, wardEvents, announcements, youthActivities] = await Promise.all([
    getCancelledSacramentMeetings(),
    getWardEvents(),
    getPublishedAnnouncements(),
    user ? getYouthActivities() : Promise.resolve([]),
  ]);

  const items: CalendarItem[] = [];

  for (const meeting of cancelledSacramentMeetings) {
    items.push({
      date: meeting.date,
      time: null,
      title: `Sacrament Meeting (No Sacrament Meeting${meeting.cancellation_note ? ` due to ${meeting.cancellation_note}` : ""})`,
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
