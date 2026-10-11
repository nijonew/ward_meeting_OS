import { getMountainTimeNow } from "@/lib/data/timezone";

export type SeasonTheme = "default" | "christmas" | "easter";

/**
 * "the church's website uses a blue general color scheme, the
 * reddish color scheme we are using now for christmastime, and a
 * purpleish scheme for easter time... Can you determine what those
 * are, when they are used, and apply that same coloration change to
 * this app?" (the user's own request, 2026-10-11).
 *
 * Verified directly against churchofjesuschrist.org's own live site
 * and several Wayback Machine snapshots (not guessed) before writing
 * any code -- its CSS exposes real `--theme-*` custom properties:
 *   - Default, most of the year: blue (`#006184` primary / `#007da5`
 *     hover / `#005175` click). Confirmed on an Oct 2025 General
 *     Conference weekend, a July 2025 Pioneer Day, and today's live
 *     site -- none of those get a special color.
 *   - Christmas: red (`#D50032` / `#950023` hover / `#6d0019` dark).
 *     Confirmed active Nov 27, 2025 (Thanksgiving) and Dec 24, 2025;
 *     NOT active Nov 1, 2025 -- the real site's own switch date falls
 *     somewhere in between, not pinned down exactly. This app uses
 *     Dec 1 -- Jan 6 (Christmastide's own traditional bounds) as a
 *     clean, defensible window rather than guessing the real site's
 *     undocumented exact day.
 *   - Easter: purple (`#592569` / `#84389e` hover / `#421c4f` dark).
 *     Confirmed active April 18, 2025 (Good Friday, Easter 2025 was
 *     April 20) -- only one data point, so the real site's exact
 *     window start is likewise unconfirmed. This app uses the 14 days
 *     before Easter Sunday through Easter Sunday itself.
 *   - **No fourth, green season was found** -- checked General
 *     Conference weekends (Oct/April), Pioneer Day, and Thanksgiving
 *     week directly; all were either blue or (for the two inside the
 *     Christmas window) red. Only three real states exist as far as
 *     this was able to verify.
 *
 * Applied the same way this app already handles "what color is this
 * right now" -- rotating the existing `--color-accent`/`-deep`/`-soft`
 * tokens' *hue* only (`app/globals.css`), keeping their lightness/
 * chroma exactly as designed, via a `data-season` attribute set on
 * `<html>` in app/layout.tsx. The app's own pre-existing accent hue
 * (20) already matches the church site's red almost exactly (measured
 * at hue 19-21 across its three red shades) -- confirms this app's
 * current permanent color was itself modeled on the Christmas scheme,
 * per the user's own observation -- so "christmas" keeps that hue
 * unchanged; "default" and "easter" rotate to the church site's
 * measured blue (hue ~231) and purple (hue ~317) respectively.
 *
 * Mountain Time, not the server's own UTC clock (same reasoning as
 * isSacramentMeetingPubliclyVisible) -- a seasonal color flipping a
 * few hours off from local midnight is a much smaller deal than the
 * Sacrament Meeting bug that prompted building that fix, but reusing
 * the same real-timezone source is free and avoids introducing a new,
 * narrower date bug here.
 */
function easterSunday(year: number): { month: number; day: number } {
  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher) -- verified
  // against six real years (2023-2028) before trusting it.
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

export function getSeasonTheme(): SeasonTheme {
  const { dateIso } = getMountainTimeNow();
  const [yearStr, monthStr, dayStr] = dateIso.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (month === 12 || (month === 1 && day <= 6)) return "christmas";

  const easter = easterSunday(year);
  const easterUTC = Date.UTC(year, easter.month - 1, easter.day);
  const todayUTC = Date.UTC(year, month - 1, day);
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  if (todayUTC >= easterUTC - fourteenDaysMs && todayUTC <= easterUTC) return "easter";

  return "default";
}
