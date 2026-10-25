const MOUNTAIN_TIME_ZONE = "America/Denver";

/**
 * Current date (YYYY-MM-DD), hour (0-23), and time-of-day
 * (zero-padded "HH:MM:SS", lexically comparable against a Postgres
 * `time` column's own string form) in Mountain Time -- via the real
 * IANA "America/Denver" zone, which correctly tracks the MST/MDT
 * transition, not a fixed UTC offset that would drift wrong twice a
 * year.
 */
export function getMountainTimeNow(): { dateIso: string; hour: number; timeIso: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MOUNTAIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // Intl can render midnight as hour "24" rather than "00" depending on
  // the runtime -- normalize that back to 0.
  const hourRaw = parseInt(get("hour"), 10);
  const hour = hourRaw === 24 ? 0 : hourRaw;
  const hourPadded = String(hour).padStart(2, "0");

  return {
    dateIso: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    timeIso: `${hourPadded}:${get("minute")}:${get("second")}`,
  };
}

/**
 * Sacrament Meeting's public program becomes visible starting at
 * 6:00 AM Mountain Time on the meeting's own date, not at midnight --
 * the user's own request (2026-10-11), after noticing the *next* day's
 * meeting was visible to the public the evening before. Root cause:
 * both call sites that used to gate this (getTodaysPublishedSacramentMeeting
 * and this public page's own check) compared against a plain
 * `new Date().toISOString().slice(0, 10)` -- UTC, which rolls over to
 * the next calendar day 6-7 hours before midnight actually arrives in
 * Mountain Time (depending on daylight saving). The 6 AM floor also
 * absorbs any remaining slop around that rollover rather than exposing
 * the program the instant Mountain Time's own midnight ticks over.
 *
 * Only Sacrament Meeting's own "no login, today only" public page uses
 * this -- an admin's own any-stage/any-date preview (checked before
 * this in app/meetings/[id]/public/page.tsx) is unaffected.
 */
export function isSacramentMeetingPubliclyVisible(meetingDateIso: string): boolean {
  const { dateIso, hour } = getMountainTimeNow();
  return dateIso === meetingDateIso && hour >= 6;
}
