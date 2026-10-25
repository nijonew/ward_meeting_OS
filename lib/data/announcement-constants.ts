/**
 * Option lists lifted directly from Heritage Ward's real announcement
 * form (pasted by the user 2026-09-05, after the linked Google Form
 * 401'd on every fetch attempt -- see PROJECT_CONTEXT.md). Organization
 * and Type are the form's radio (single-select) questions -- each has a
 * real "Other" option with a free-text override. Audience and Where
 * Announced are the form's checkbox (multi-select) questions -- no
 * "Other" on either, per the pasted form.
 */

export const ANNOUNCEMENT_ORGANIZATIONS = [
  { value: "Stake", label: "Stake" },
  { value: "Bishopric", label: "Bishopric" },
  { value: "Relief Society", label: "Relief Society" },
  { value: "Elders Quorum", label: "Elders Quorum" },
  { value: "Youth - YW", label: "Youth - YW" },
  { value: "Youth - YM", label: "Youth - YM" },
  { value: "Sunday School", label: "Sunday School" },
  { value: "Primary", label: "Primary" },
  { value: "Ward Council", label: "Ward Council" },
  { value: "Ward Mission", label: "Ward Mission" },
] as const;

export const ANNOUNCEMENT_AUDIENCES = [
  "Whole Ward",
  "All Adults",
  "All Youth",
  "Deacons",
  "Teachers",
  "Priests",
  "Young Women 12-13",
  "Young Women 14-15",
  "Young Women 16-18",
  "Relief Society",
  "Elders Quorum",
  "Sunday School",
  "Primary Children",
  "Single Adults 18-35",
  "Single Adults 36-45",
  "Single Adults 46+",
] as const;

export const ANNOUNCEMENT_WHERE = [
  "Sacrament Meeting",
  "Bishopric Meeting",
  "Ward Council Meeting",
  "Youth Council Meeting",
  "Relief Society Class",
  "Elders Quorum Class",
  "Sunday School - Gospel Doctrine Class",
  "All YM",
  "All YW",
  "Deacons",
  "Teachers",
  "Priests",
  "Young Women 12-13",
  "Young Women 14-15",
  "Young Women 16-18",
  "Primary Sharing Time",
  "Ward Communications (Printed, Weekly Email, Social Media, etc.)",
] as const;

/**
 * "Sacrament Meeting" (added 2026-10-25, migration 083) works
 * differently from the other three `MEETING_TYPE_ANNOUNCEMENT_LABEL`
 * entries above -- those are a live read of `where_announced` with no
 * pull/consume step; Sacrament Meeting still uses the existing
 * explicit-pull `sacrament_announcement_pulls` table, just populated
 * automatically now instead of by hand. See
 * `autoPullSacramentAnnouncements` (lib/data/sacrament-announcements.ts).
 */
export const SACRAMENT_MEETING_ANNOUNCEMENT_LABEL = "Sacrament Meeting";

/**
 * A recurring announcement's cadence (migration 083) -- `start_date`/
 * `end_date` stay the series' own first/last occurrence date (end
 * nullable = ongoing), `start_time`/`end_time` stay each occurrence's
 * own time; these three values just describe which days within that
 * window the series actually falls on, for a human-readable phrase
 * ("Weekly on Sundays," "Monthly on the 2nd Tuesday," "Monthly on the
 * 15th") instead of a date range that reads like one continuous
 * event. `null`/unset means a one-time item -- the existing behavior,
 * completely unchanged.
 */
export const ANNOUNCEMENT_RECURRENCE_TYPES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly_nth_weekday", label: "Monthly (same weekday, e.g. \"2nd Tuesday\")" },
  { value: "monthly_date", label: "Monthly (same date, e.g. \"the 15th\")" },
] as const;

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const WEEKDAY_PLURAL_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"] as const;
export const NTH_OCCURRENCE_NAMES = ["1st", "2nd", "3rd", "4th", "5th"] as const;

export const ANNOUNCEMENT_TYPES = [
  { value: "Single Event", label: "Single Event (scheduled meeting, activity, etc.)" },
  { value: "Ongoing Event", label: "Ongoing Event (long term class)" },
  { value: "Future - For Planning", label: "Future - For planning" },
  { value: "Action", label: "Action (e.g., “Sign up for ___,” “Bring __ on ___day”)" },
  { value: "General Information", label: "General information (meeting room/time changes, etc.)" },
  { value: "Assignments", label: "Assignments (rotations, duties, etc.)" },
  { value: "Lesson", label: "Lesson" },
] as const;

/** Both the form's single-select questions offer a free-text "Other". */
export const OTHER_VALUE = "Other";

export const MULTI_SELECT_SEPARATOR = ", ";

/**
 * Which `ANNOUNCEMENT_WHERE` label corresponds to each collaborative
 * meeting type's own Review section (2026-10-19) -- an announcement
 * shows up there automatically whenever this label is checked in its
 * own "Where should this be announced?" field, with no separate
 * pull/consume step. Sacrament Meeting is deliberately not here -- its
 * own Announcements block uses a completely different, explicit-pull
 * mechanism (see lib/data/sacrament-announcements.ts).
 */
export const MEETING_TYPE_ANNOUNCEMENT_LABEL: Record<"bishopric-meeting" | "ward-council" | "youth-council", string> = {
  "bishopric-meeting": "Bishopric Meeting",
  "ward-council": "Ward Council Meeting",
  "youth-council": "Youth Council Meeting",
};
