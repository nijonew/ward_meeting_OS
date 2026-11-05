import { createClient } from "@/lib/supabase/server";
import { getWardEvents } from "@/lib/data/ward-events";
import { getPublishedAnnouncements } from "@/lib/data/general-submissions";
import { announcementOccurrenceDates } from "@/lib/data/announcements";
import { getYouthActivities, type YouthActivityRow } from "@/lib/data/youth-activities";
import { ACTIVITY_CLASSES, classesForCombinedGroup } from "@/lib/data/class-activities-shared";
import { getSessionUser, hasFeature, type SessionProfile } from "@/lib/supabase/get-session-user";
import { getVisibleMeetingTypesForUser } from "@/lib/data/meeting-type-access";
import { MEETING_TYPE_LABELS, type MeetingTypeSlug } from "@/lib/types";

export type CalendarItemKind = "sacrament" | "ward" | "announcement" | "youth" | "meeting";

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
 *   `/announcements/public` shows. A one-time item places one item on
 *   its own `start_date`, same as always. **A recurring one expands
 *   into a real item on every date it actually falls on, 2026-11-04**
 *   (the user's own report: "events that recur are not showing up for
 *   each occurrence in the calendar" -- the original version showed it
 *   once, on the series' own start date only, same shape as the public
 *   Announcements LIST page's own single row -- fine there, since that
 *   page already states the cadence in words ("Weekly on Sundays..."),
 *   but wrong for a day-by-day grid, where a recurring item needs a dot
 *   on every day it happens). `announcementOccurrenceDates`
 *   (`lib/data/announcements.ts`) computes those real dates, bounded to
 *   `[rangeStartIso, rangeEndIso]` -- the caller's own currently-
 *   displayed month grid -- since an ongoing series (`end_date` left
 *   null on purpose) has no real upper bound to expand against
 *   otherwise.
 * - **"My meetings," added 2026-11-05** -- Bishopric Meeting/Ward
 *   Council/Youth Council occurrences this signed-in account is
 *   either invited to by calling, or (Youth Council specifically)
 *   leads the youth program regardless of calling. See
 *   `resolvePersonalMeetingTypes`'s own comment for the two paths and
 *   `buildPersonalMeetingItems` for how a cancelled one renders.
 *   Logged-out visitors get none, same gating as Youth Activities.
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
 * **Plain "TBD" placeholders DO show here, reversed 2026-11-05** --
 * this function originally excluded an un-cancelled "TBD" row
 * entirely (2026-11-04), on the theory that it was just noise on a
 * shared calendar. The user's own direct correction, the next day,
 * laid out exactly what the entry count should be for each way a
 * week's 6 classes can be combined (1 for Combined YM/YW together, 4
 * when only one gender is combined that week, 6 when none are) and
 * was explicit that a class with nothing real planned yet still needs
 * its own line: "If a class is TBD or cancelled or something there
 * should still be an entry in the calendar saying 'Teachers: TBD' or
 * whatever." Hiding TBD broke exactly that -- a class that hadn't been
 * filled in yet just vanished from the count instead of showing as
 * "`<class>`: TBD". The per-row title logic right below already
 * produces exactly that string unmodified; TBD only ever needed to
 * stop being filtered out, nothing about how a row renders needed to
 * change. The "cancelled for all youth" collapse right below is
 * unaffected either way -- it only ever counted rows with
 * `cancelled = true`, which a plain TBD row never has.
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
function buildYouthActivityItems(youthActivities: YouthActivityRow[]): CalendarItem[] {
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

/**
 * Which non-Sacrament meeting types count as "an individual's own
 * meetings" for the calendar (2026-11-05, the user's own request: "can
 * we also have an individual's meetings to which they are typically
 * invited show up for them in their calendar view?"). Deliberately
 * excludes Sacrament Meeting -- it's already on this calendar via
 * `getCancelledSacramentMeetings` (cancelled-only, 2026-11-04, to avoid
 * showing a dot every single Sunday), and every ward member is
 * implicitly "invited" to it regardless of calling, so there's no real
 * "my meetings" distinction to draw for that one type here.
 */
const PERSONAL_MEETING_TYPES: MeetingTypeSlug[] = ["bishopric-meeting", "ward-council", "youth-council"];

interface PersonalMeetingRow {
  id: string;
  date: string;
  cancelled: boolean | null;
  cancellation_note: string | null;
  meeting_types: { slug: string } | { slug: string }[] | null;
}

async function getPersonalMeetingOccurrences(
  slugs: MeetingTypeSlug[],
  rangeStartIso: string,
  rangeEndIso: string
): Promise<PersonalMeetingRow[]> {
  if (slugs.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("id, date, cancelled, cancellation_note, meeting_types!inner(slug)")
    .in("meeting_types.slug", slugs)
    .gte("date", rangeStartIso)
    .lte("date", rangeEndIso);
  if (error || !data) return [];
  return data as unknown as PersonalMeetingRow[];
}

/**
 * Resolves which meeting types should render as "my meetings" on the
 * calendar for the signed-in account -- two independent paths, unioned
 * (2026-11-05):
 *
 * - **By calling**: whichever of Bishopric Meeting/Ward Council/Youth
 *   Council `getVisibleMeetingTypesForUser` already resolves for this
 *   account -- the exact same calling -> `meeting_type_members` (or a
 *   granted viewing/planning/agenda_items feature) resolution the
 *   landing page's own "My meetings" tiles use, narrowed to just these
 *   three types (Sacrament Meeting is excluded by `PERSONAL_MEETING_TYPES`
 *   itself, see that constant's own comment).
 * - **Youth Council for every youth leader, regardless of calling**
 *   (the user's own explicit follow-up: "I would also like the Ward
 *   Youth Council meeting to show up in the calendar view of all youth
 *   leaders"). Reuses the exact same `isYouthLeader` feature check
 *   `app/page.tsx` already defines for its own "Youth program"
 *   section (`youth_teaching_planning` or `youth_activity_planning`) --
 *   a youth leader's own calling very often doesn't map to Youth
 *   Council via `meeting_type_members` at all (that mapping is about
 *   who sits ON the council, not who leads a youth program it
 *   discusses), so this is a real, separate inclusion rule, not
 *   redundant with the calling-based path above.
 */
async function resolvePersonalMeetingTypes(userId: string, profile: SessionProfile | null): Promise<MeetingTypeSlug[]> {
  const slugs = new Set<MeetingTypeSlug>();

  const visible = await getVisibleMeetingTypesForUser(userId, profile?.features);
  for (const slug of visible) {
    if (PERSONAL_MEETING_TYPES.includes(slug)) slugs.add(slug);
  }

  if (hasFeature(profile, "youth_teaching_planning") || hasFeature(profile, "youth_activity_planning")) {
    slugs.add("youth-council");
  }

  return Array.from(slugs);
}

function buildPersonalMeetingItems(rows: PersonalMeetingRow[]): CalendarItem[] {
  return rows.map((row) => {
    const meetingType = Array.isArray(row.meeting_types) ? row.meeting_types[0] : row.meeting_types;
    const slug = (meetingType?.slug ?? "bishopric-meeting") as MeetingTypeSlug;
    const label = MEETING_TYPE_LABELS[slug];
    const title = row.cancelled ? `${label} (Cancelled${row.cancellation_note ? ` due to ${row.cancellation_note}` : ""})` : label;
    return {
      date: row.date,
      time: null,
      title,
      kind: "meeting",
      note: null,
      href: `/meetings/${row.id}`,
    };
  });
}

/**
 * `rangeStartIso`/`rangeEndIso` bound how far a recurring announcement
 * gets expanded into real per-occurrence items -- see
 * `announcementOccurrenceDates`'s own comment. Callers pass their own
 * currently-displayed range (the calendar page's own month grid,
 * including its leading/trailing days from adjacent months).
 */
export async function getCalendarItems(rangeStartIso: string, rangeEndIso: string): Promise<CalendarItem[]> {
  const { user, profile } = await getSessionUser();

  // Resolved before the main Promise.all below, since it needs the
  // user's own id/profile first and then feeds the personal-meetings
  // query that goes into that same batch.
  const personalMeetingTypes = user ? await resolvePersonalMeetingTypes(user.id, profile) : [];

  const [cancelledSacramentMeetings, wardEvents, announcements, youthActivities, personalMeetings] = await Promise.all([
    getCancelledSacramentMeetings(),
    getWardEvents(),
    getPublishedAnnouncements(),
    user ? getYouthActivities() : Promise.resolve([]),
    getPersonalMeetingOccurrences(personalMeetingTypes, rangeStartIso, rangeEndIso),
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
    if (an.recurrence) {
      for (const date of announcementOccurrenceDates(an, rangeStartIso, rangeEndIso)) {
        items.push({ date, time: an.start_time, title: an.title, kind: "announcement", note: null, href: null });
      }
      continue;
    }
    if (!an.start_date) continue; // nothing to place on the grid
    items.push({
      date: an.start_date,
      time: an.start_time,
      title: an.title,
      kind: "announcement",
      note: null,
      href: null,
    });
  }

  items.push(...buildYouthActivityItems(youthActivities));
  items.push(...buildPersonalMeetingItems(personalMeetings));

  return items;
}
