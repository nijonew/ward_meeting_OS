import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getCalendarItems, type CalendarItem, type CalendarItemKind } from "@/lib/data/calendar";
import { getMountainTimeNow } from "@/lib/data/timezone";
import { getSessionUser } from "@/lib/supabase/get-session-user";

/**
 * Public Ward Calendar View (2026-11-01) -- no login required, same
 * tier as /announcements/public and /events. Originally scoped via
 * AskUserQuestion to show Sacrament Meeting (day-of only), Youth
 * Activities, Ward Events, and dated Announcements; reworked twice the
 * same day per the user's own follow-ups -- see getCalendarItems' own
 * doc comment for the current scope (Sacrament Meeting shows only when
 * cancelled, with its own reason shown inline; Ward Events and
 * Announcements unchanged).
 *
 * **Youth Activities are logged-in-only, 2026-11-04** -- the page
 * itself needs no gate for this (it's `getCalendarItems()`'s own job
 * to decide whether to include any at all), but still renders
 * perfectly well with zero youth items for a logged-out visitor.
 *
 * **"My Meetings" (Bishopric Meeting/Ward Council/Youth Council
 * occurrences this account is invited to), added 2026-11-05** -- same
 * logged-in-only shape as Youth Activities; see
 * `resolvePersonalMeetingTypes` in `lib/data/calendar.ts` for who
 * actually sees which.
 *
 * Month navigation is plain `?y=&m=` links -- no client state needed,
 * since every month's own content is already public and cheap to
 * refetch. `getCalendarItems()` fetches every source unfiltered by
 * month (none of them are large enough in a single ward for that to
 * matter) and this page buckets them by date server-side once per
 * render -- **except a recurring announcement's own per-occurrence
 * expansion, 2026-11-04**, which does need the displayed range (this
 * page's own `gridStart`/`gridEnd`, computed before calling
 * `getCalendarItems` now instead of after) -- see that function's own
 * comment for why an ongoing series can't expand without one.
 *
 * **Accepted mobile tradeoff**: a 7-column month grid needs real width
 * to stay legible -- this wraps in the same `overflow-x-auto` pattern
 * this app already uses for its wide admin grids, rather than
 * collapsing into a different (non-calendar) layout on a narrow phone.
 * A month-grid calendar inherently has this tension; the alternative
 * (a date-grouped list) was the other option offered when this was
 * scoped, and wasn't the one chosen.
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const KIND_LABELS: Record<CalendarItemKind, string> = {
  // "Sacrament Meeting Cancelled," not the bare type name, 2026-11-04 --
  // this kind only ever shows up when one's cancelled now (see
  // getCancelledSacramentMeetings, lib/data/calendar.ts), so the plain
  // "Sacrament Meeting" label would wrongly suggest this dot shows up
  // every Sunday.
  sacrament: "Sacrament Meeting Cancelled",
  ward: "Ward Event",
  announcement: "Announcement",
  youth: "Youth Activity",
  meeting: "My Meetings",
};

const KIND_DOT_CLASS: Record<CalendarItemKind, string> = {
  sacrament: "bg-accent",
  ward: "bg-ink/40",
  announcement: "bg-danger",
  youth: "bg-success",
  meeting: "bg-ink",
};

function monthHref(year: number, month: number): string {
  return `/calendar?y=${year}&m=${month}`;
}

function DayItem({ item }: { item: CalendarItem }) {
  const content = (
    <span className="flex items-start gap-1">
      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT_CLASS[item.kind]}`} aria-hidden="true" />
      <span className="text-ink">{item.title}</span>
    </span>
  );
  if (!item.href) return content;
  return (
    <Link href={item.href} prefetch={false} className="hover:underline">
      {content}
    </Link>
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const { y, m } = await searchParams;
  const { user } = await getSessionUser();
  const { dateIso: todayIso } = getMountainTimeNow();
  const [todayYear, todayMonth] = todayIso.split("-").map(Number);

  const requestedYear = Number(y);
  const requestedMonth = Number(m);
  const year = Number.isInteger(requestedYear) && requestedYear > 0 ? requestedYear : todayYear;
  const month =
    Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : todayMonth;

  // Full weeks only -- start on the Sunday on/before the 1st, end on
  // the Saturday on/after the month's own last day, so every month
  // renders 4-6 complete rows with no partial trailing week. Computed
  // before getCalendarItems now (2026-11-04), not after -- it needs
  // this same range to bound a recurring announcement's own expansion.
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - firstOfMonth.getDay());
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - lastOfMonth.getDay()));
  const gridStartIso = `${gridStart.getFullYear()}-${pad(gridStart.getMonth() + 1)}-${pad(gridStart.getDate())}`;
  const gridEndIso = `${gridEnd.getFullYear()}-${pad(gridEnd.getMonth() + 1)}-${pad(gridEnd.getDate())}`;

  const items = await getCalendarItems(gridStartIso, gridEndIso);
  const itemsByDate = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const list = itemsByDate.get(item.date);
    if (list) list.push(item);
    else itemsByDate.set(item.date, [item]);
  }

  const days: { iso: string; day: number; inMonth: boolean; isToday: boolean }[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const iso = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
    days.push({
      iso,
      day: cursor.getDate(),
      inMonth: cursor.getMonth() === month - 1 && cursor.getFullYear() === year,
      isToday: iso === todayIso,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const isCurrentMonth = year === todayYear && month === todayMonth;

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Calendar" />

      <section className="mt-4">
        <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">Calendar</h1>
      </section>

      <div className="flex items-center justify-between">
        <Link href={monthHref(prevYear, prevMonth)} prefetch={false} className="text-sm text-ink-muted hover:text-ink">
          &larr; Previous
        </Link>
        <div className="flex items-center gap-3">
          <p className="font-display text-lg">{monthLabel}</p>
          {!isCurrentMonth && (
            <Link href="/calendar" className="text-xs font-mono uppercase tracking-wider text-accent hover:underline">
              Today
            </Link>
          )}
        </div>
        <Link href={monthHref(nextYear, nextMonth)} prefetch={false} className="text-sm text-ink-muted hover:text-ink">
          Next &rarr;
        </Link>
      </div>

      <div className="overflow-x-auto rounded border border-rule bg-surface">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b border-rule">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <div
                key={label}
                className="px-2 py-1 text-center font-mono text-[10px] uppercase tracking-wider text-ink-muted"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const dayItems = itemsByDate.get(d.iso) ?? [];
              return (
                <div
                  key={d.iso}
                  className={[
                    "min-h-[6rem] border-b border-r border-rule/60 p-1.5",
                    d.inMonth ? "bg-surface" : "bg-paper/40",
                  ].join(" ")}
                >
                  <p
                    className={[
                      "font-mono text-[11px]",
                      d.isToday
                        ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-paper"
                        : d.inMonth
                          ? "text-ink"
                          : "text-ink-muted/50",
                    ].join(" ")}
                  >
                    {d.day}
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {dayItems.map((item, i) => (
                      <li key={i} className="text-[11px] leading-tight">
                        <DayItem item={item} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-ink-muted">
        {(Object.keys(KIND_LABELS) as CalendarItemKind[])
          .filter((kind) => (kind !== "youth" && kind !== "meeting") || user)
          .map((kind) => (
            <span key={kind} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${KIND_DOT_CLASS[kind]}`} aria-hidden="true" />
              {KIND_LABELS[kind]}
            </span>
          ))}
      </div>
    </main>
  );
}
