import { cache } from "react";
import { getSessionUser, hasAnyFeature, hasFeature } from "@/lib/supabase/get-session-user";
import { getVisibleMeetingTypesForUser } from "@/lib/data/meeting-type-access";
import { allMeetingFeatures } from "@/lib/data/meeting-features";
import { MEETING_TYPE_LABELS } from "@/lib/types";

export interface NavLink {
  title: string;
  href: string;
}

export interface NavSection {
  title: string;
  links: NavLink[];
}

/**
 * The single source of truth for "which feature categories/tiles does
 * this signed-in account see" -- built 2026-11-05 for the persistent
 * side nav (the user's own request: "adding a menu on the side with
 * the categories and the features associated with those categories
 * from our cleanup"), factored out of `app/page.tsx` rather than
 * duplicated, per this app's own "Single Source of Truth"/"Views
 * Instead of Duplicate Data" design principles (architecture.md) --
 * `app/page.tsx` itself now calls this for its own My meetings/
 * Announcements/Meeting Planning/Youth program/Admin sections instead
 * of re-deriving the identical gating a second time.
 *
 * Deliberately does NOT include "This week" -- that section's three
 * tiles are either genuinely public (no login at all) or carry
 * per-request state the home page itself still computes fresh (which
 * specific Sacrament Meeting is today's/early-access, the disabled-vs-
 * linked Youth Activities tile for a logged-out visitor) -- there's no
 * single stable link for "today's Sacrament Meeting program," so a
 * persistent nav has nothing stable to point at for that one tile.
 * `components/NavDrawer.tsx`'s own small "This week" group (Calendar +
 * public Announcements, always; Youth Activities, logged-in only) is
 * hand-written separately for exactly this reason, not sourced here.
 *
 * Returns an empty list for a logged-out visitor or an account with
 * none of these features -- callers should render nothing for that
 * case (same as `app/page.tsx` already does for each section today).
 *
 * Wrapped in React's `cache()` (same fix already applied to
 * `getSessionUser`/`getWardName`/`getMeetingById`) -- `AppHeader` calls
 * this on nearly every page already, and the home page now ALSO calls
 * it directly for its own tile grid; without this, that one page would
 * run every underlying query here twice in the same request.
 */
export const getNavSections = cache(async (): Promise<NavSection[]> => {
  const { user, profile } = await getSessionUser();
  if (!user) return [];

  const sections: NavSection[] = [];

  const visibleMeetingTypes = await getVisibleMeetingTypesForUser(user.id, profile?.features);
  const attendsMeetings = visibleMeetingTypes.length > 0;

  if (attendsMeetings) {
    const links: NavLink[] = visibleMeetingTypes.map((slug) => ({
      title: MEETING_TYPE_LABELS[slug],
      href: `/dashboard?type=${slug}`,
    }));
    links.push({ title: "Meeting Agenda Items", href: "/submit/agenda-item" });
    if (hasFeature(profile, "sacrament_program_view")) {
      links.push({ title: "Sacrament Meeting Programs", href: "/dashboard?type=sacrament-meeting&readonly=1" });
    }
    sections.push({ title: "My meetings", links });
  }

  const canSubmitAnnouncement = attendsMeetings || hasFeature(profile, "announcement_adding");
  const canAnnouncementManagement = hasFeature(profile, "announcement_management");
  if (canSubmitAnnouncement || canAnnouncementManagement) {
    const links: NavLink[] = [];
    if (canSubmitAnnouncement) links.push({ title: "Submit an Announcement", href: "/submit/announcement" });
    if (canAnnouncementManagement) links.push({ title: "Manage Announcements", href: "/announcements" });
    sections.push({ title: "Announcements", links });
  }

  const canPlanAnyMeeting = hasAnyFeature(profile, allMeetingFeatures("planning"));
  const canMeetingSchedule = hasFeature(profile, "meeting_schedule");
  const canMeetingCancellations = hasFeature(profile, "meeting_cancellations");
  const canRotations = hasFeature(profile, "rotations");
  const canSpeakerPrayerHistory = hasFeature(profile, "speaker_prayer_history");
  const canMeetingPlanningHub =
    canPlanAnyMeeting || canMeetingSchedule || canMeetingCancellations || canRotations || canSpeakerPrayerHistory;
  const canCallingPlanning = hasFeature(profile, "calling_planning");
  const isMusicPlanner = hasFeature(profile, "sacrament_music");
  const canAdultTeachingPlanning = hasFeature(profile, "adult_teaching_planning");
  if (canMeetingPlanningHub || canCallingPlanning || isMusicPlanner || canAdultTeachingPlanning) {
    const links: NavLink[] = [];
    if (canMeetingPlanningHub) links.push({ title: "Meeting Planning", href: "/meeting-planning" });
    if (canCallingPlanning) links.push({ title: "Calling Planning", href: "/calling-planning" });
    if (isMusicPlanner) links.push({ title: "Sacrament Meeting Music Planning", href: "/music" });
    if (canAdultTeachingPlanning) links.push({ title: "Elders Quorum / Relief Society Teaching", href: "/adult-teaching-planning" });
    sections.push({ title: "Meeting Planning", links });
  }

  const isYouthLeader = hasFeature(profile, "youth_teaching_planning") || hasFeature(profile, "youth_activity_planning");
  if (isYouthLeader) {
    sections.push({ title: "Youth program", links: [{ title: "Youth Activity Planning", href: "/youth-activity-planning" }] });
  }

  const canTableAdmin =
    hasFeature(profile, "meeting_templates_admin") ||
    hasFeature(profile, "verify_logins") ||
    Array.from(profile?.features ?? []).some((f) => f.startsWith("table_admin_"));
  if (canTableAdmin) {
    sections.push({ title: "Admin", links: [{ title: "Table Admin", href: "/admin" }] });
  }

  return sections;
});
