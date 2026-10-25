"use client";

import { useState } from "react";
import { ANNOUNCEMENT_RECURRENCE_TYPES, WEEKDAY_NAMES, NTH_OCCURRENCE_NAMES } from "@/lib/data/announcement-constants";

const SELECT_CLASS = "rounded border border-rule bg-paper px-2 py-2 text-xs text-ink";

/**
 * "Is this a recurring thing?" toggle + cadence picker for the
 * Announcement submit form (migration 083, 2026-10-25) -- the user's
 * own report: a one-time date range on a weekly class ("Sunday,
 * September 6th... Sunday, November 22nd") reads like it runs every
 * day in between, not "weekly on Sundays." Three shapes, confirmed
 * directly with the user: weekly, monthly on the same weekday ("2nd
 * Tuesday"), monthly on the same date ("the 15th") -- deliberately not
 * the full Meeting-Schedule-style cadence engine
 * (`lib/data/cadence.ts`/`CadenceFields.tsx`), which also generates
 * real calendar rows; an announcement just needs a phrase to display,
 * not individual occurrence rows, so this is its own smaller picker
 * sharing the same weekday/nth vocabulary for consistency.
 *
 * When off, Start/End Date/Time render with their original labels (a
 * single event's own date/time). When on, the same four inputs are
 * relabeled "Series Start/End Date"/"Time" -- same fields, same
 * `name`s, just read as "the window this recurs within" and "each
 * occurrence's own time" instead of one event's start/end.
 */
export function RecurrenceToggle({ children }: { children: (recurring: boolean) => React.ReactNode }) {
  const [recurring, setRecurring] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="hidden" name="is_recurring" value="" />
        <input type="checkbox" name="is_recurring" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
        This is a recurring item (a weekly/monthly class, etc.), not a single date
      </label>
      {recurring && <RecurrenceFields />}
      {children(recurring)}
    </div>
  );
}

function RecurrenceFields() {
  const [recurrence, setRecurrence] = useState<string>("weekly");

  return (
    <div className="rounded border border-rule px-3 py-2">
      <label className="text-xs text-ink-muted">
        How often?
        <select
          name="recurrence"
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value)}
          className={`mt-1 block w-full ${SELECT_CLASS}`}
        >
          {ANNOUNCEMENT_RECURRENCE_TYPES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      {recurrence === "weekly" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          Every
          <select name="recurrence_day_of_week" required className={SELECT_CLASS}>
            {WEEKDAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      {recurrence === "monthly_nth_weekday" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          The
          <select name="recurrence_nth_occurrence" required className={SELECT_CLASS}>
            {NTH_OCCURRENCE_NAMES.map((n, i) => (
              <option key={n} value={i + 1}>
                {n}
              </option>
            ))}
          </select>
          <select name="recurrence_day_of_week" required className={SELECT_CLASS}>
            {WEEKDAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          of the month
        </div>
      )}

      {recurrence === "monthly_date" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          The
          <input
            type="number"
            name="recurrence_day_of_month"
            required
            min={1}
            max={31}
            placeholder="Day"
            className={`${SELECT_CLASS} w-16`}
          />
          of the month
        </div>
      )}
    </div>
  );
}
