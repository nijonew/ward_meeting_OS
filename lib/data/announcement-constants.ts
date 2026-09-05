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
  "Bishopric Meeting",
  "Ward Council Meeting",
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
