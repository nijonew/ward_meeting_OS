import type { Meeting, MeetingType } from "./types";

/**
 * TEMPORARY: stands in for the Notion-backed data source until
 * Priority 7 (Notion synchronization) is built. Shaped to match
 * Meeting / MeetingType exactly so the swap should only touch this
 * file and a future lib/notion.ts, not the page components.
 */

export const MEETING_TYPES: MeetingType[] = [
  { slug: "sacrament-meeting", name: "Sacrament Meeting", isBuilt: true },
  { slug: "bishopric-meeting", name: "Bishopric Meeting", isBuilt: false },
  { slug: "ward-council", name: "Ward Council", isBuilt: false },
  { slug: "youth-council", name: "Youth Council", isBuilt: false },
];

export const UPCOMING_MEETING: Meeting = {
  id: "mock-sacrament-2026-08-09",
  meetingType: "sacrament-meeting",
  title: "Sacrament Meeting",
  date: "2026-08-09",
  stage: "planning",
};
