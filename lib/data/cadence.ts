/**
 * Pure date-computation helpers shared by every cadence-rule feature
 * (Meeting Schedule, Youth Activity Schedule, Ward Event Schedule).
 * Extracted from lib/data/meeting-schedule.ts so the three cadence
 * shapes (weekly / nth_weekday / relative) stay defined in exactly one
 * place -- a second, drifted copy of this date math would be a real bug
 * risk given how fiddly month-boundary handling is.
 */

export type CadenceShape = "weekly" | "nth_weekday" | "relative";

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** All dates matching day_of_week between start and end (inclusive), for a 'weekly' rule. */
export function weeklyDates(start: Date, end: Date, dayOfWeek: number): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
  while (d <= end) {
    dates.push(toISODate(d));
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

/** The Nth occurrence of dayOfWeek in the given month, or null if that month doesn't have one (e.g. no 5th). */
export function nthOccurrenceInMonth(year: number, month: number, dayOfWeek: number, nth: number): Date | null {
  const matches: Date[] = [];
  for (let day = 1; day <= 31; day++) {
    const candidate = new Date(year, month, day);
    if (candidate.getMonth() !== month) break; // ran past end of month
    if (candidate.getDay() === dayOfWeek) matches.push(candidate);
  }
  return matches[nth - 1] ?? null;
}

/** The Nth occurrence of day_of_week in each month between start and end (inclusive). */
export function nthWeekdayDates(start: Date, end: Date, dayOfWeek: number, nth: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last) {
    const picked = nthOccurrenceInMonth(cursor.getFullYear(), cursor.getMonth(), dayOfWeek, nth);
    if (picked && picked >= start && picked <= end) {
      dates.push(toISODate(picked));
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return dates;
}

/**
 * Dates computed as "offsetDays days after (or before, if negative) the
 * Nth occurrence of anchorDayOfWeek" in each month -- e.g. "2 days after
 * the 3rd Sunday" (the Tuesday that follows it, whichever numbered
 * Tuesday that happens to be that month). Iterates one month of padding
 * on each side of the range so an offset that crosses a month boundary
 * still gets caught.
 */
export function relativeDates(
  start: Date,
  end: Date,
  anchorDayOfWeek: number,
  anchorNth: number,
  offsetDays: number
): string[] {
  const dates: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const last = new Date(end.getFullYear(), end.getMonth() + 1, 1);

  while (cursor <= last) {
    const anchor = nthOccurrenceInMonth(cursor.getFullYear(), cursor.getMonth(), anchorDayOfWeek, anchorNth);
    if (anchor) {
      const candidate = new Date(anchor);
      candidate.setDate(candidate.getDate() + offsetDays);
      if (candidate >= start && candidate <= end) {
        dates.push(toISODate(candidate));
      }
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return dates;
}

/** Computes candidate dates for any of the three cadence shapes, given the shape-specific fields. */
export function candidateDatesForCadence(
  start: Date,
  end: Date,
  cadence: CadenceShape,
  fields: {
    day_of_week: number | null;
    nth_occurrence: number | null;
    anchor_day_of_week: number | null;
    anchor_nth_occurrence: number | null;
    offset_days: number | null;
  }
): string[] {
  if (cadence === "weekly") {
    return weeklyDates(start, end, fields.day_of_week ?? 0);
  }
  if (cadence === "nth_weekday") {
    return nthWeekdayDates(start, end, fields.day_of_week ?? 0, fields.nth_occurrence ?? 1);
  }
  return relativeDates(
    start,
    end,
    fields.anchor_day_of_week ?? 0,
    fields.anchor_nth_occurrence ?? 1,
    fields.offset_days ?? 0
  );
}

/** Reads and validates the cadence-dependent fields shared by every cadence-rule form. */
export function readCadenceFields(formData: FormData):
  | {
      cadence: CadenceShape;
      day_of_week: number | null;
      nth_occurrence: number | null;
      anchor_day_of_week: number | null;
      anchor_nth_occurrence: number | null;
      offset_days: number | null;
    }
  | { error: string } {
  const cadence = String(formData.get("cadence") ?? "");

  let day_of_week: number | null = null;
  let nth_occurrence: number | null = null;
  let anchor_day_of_week: number | null = null;
  let anchor_nth_occurrence: number | null = null;
  let offset_days: number | null = null;

  if (cadence === "weekly") {
    const raw = formData.get("day_of_week");
    if (raw === null || raw === "") return { error: "Choose a day of the week." };
    day_of_week = Number(raw);
  } else if (cadence === "nth_weekday") {
    const dayRaw = formData.get("day_of_week");
    const nthRaw = formData.get("nth_occurrence");
    if (dayRaw === null || dayRaw === "") return { error: "Choose a day of the week." };
    if (nthRaw === null || nthRaw === "") return { error: "Choose 1st through 5th." };
    day_of_week = Number(dayRaw);
    nth_occurrence = Number(nthRaw);
  } else if (cadence === "relative") {
    const anchorDayRaw = formData.get("anchor_day_of_week");
    const anchorNthRaw = formData.get("anchor_nth_occurrence");
    const offsetRaw = formData.get("offset_days");
    if (anchorDayRaw === null || anchorDayRaw === "") return { error: "Choose the anchor day of the week." };
    if (anchorNthRaw === null || anchorNthRaw === "") return { error: "Choose the anchor's 1st through 5th." };
    if (offsetRaw === null || offsetRaw === "") return { error: "Enter a day offset." };
    anchor_day_of_week = Number(anchorDayRaw);
    anchor_nth_occurrence = Number(anchorNthRaw);
    offset_days = Number(offsetRaw);
  } else {
    return { error: "Unknown cadence." };
  }

  return { cadence, day_of_week, nth_occurrence, anchor_day_of_week, anchor_nth_occurrence, offset_days };
}
