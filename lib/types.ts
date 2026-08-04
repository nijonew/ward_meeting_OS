/**
 * Core domain types for Ward Meeting OS.
 *
 * These mirror the entities defined in architecture.md. Until Notion
 * synchronization (Priority 7) is built, the app reads placeholder data
 * shaped to these same types (see lib/mock-data.ts), so wiring in the
 * real Notion-backed data source later shouldn't require UI changes.
 */

export type MeetingLifecycleStage =
  | "template"
  | "planning"
  | "review"
  | "ready"
  | "live"
  | "archived";

/** Ordered per the lifecycle in architecture.md section 4. */
export const MEETING_LIFECYCLE_STAGES: MeetingLifecycleStage[] = [
  "template",
  "planning",
  "review",
  "ready",
  "live",
  "archived",
];

export type MeetingTypeSlug =
  | "sacrament-meeting"
  | "bishopric-meeting"
  | "ward-council"
  | "youth-council";

export interface MeetingType {
  slug: MeetingTypeSlug;
  name: string;
  /** Whether the full Planning/Conducting/Public workflow is built yet. */
  isBuilt: boolean;
}

export interface Meeting {
  id: string;
  meetingType: MeetingTypeSlug;
  title: string;
  /** ISO date, e.g. "2026-08-09". Sunday meetings only, per current Notion structure. */
  date: string;
  stage: MeetingLifecycleStage;
}
