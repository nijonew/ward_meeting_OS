import { cache } from "react";
import { getSessionUser, hasAnyFeature, hasFeature } from "@/lib/supabase/get-session-user";
import { getVisibleMeetingTypesForUser } from "@/lib/data/meeting-type-access";
import { allMeetingFeatures } from "@/lib/data/meeting-features";
import { getAccessibleClasses, TEACHING_CLASSES, ADULT_TEACHING_CLASSES } from "@/lib/data/teaching-assignments";
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

  // Resolved concurrently, each passed the personId getSessionUser()
  // already looked up, so neither re-queries `people` by profile_id a
  // second/third time in this request (2026-11-14 performance pass --
  // this function runs on nearly every page via AppHeader).
  const [visibleMeetingTypes, accessibleTeachingClasses] = await Promise.all([
    getVisibleMeetingTypesForUser(user.id, profile?.features, profile?.personId),
    // Calling-based teaching scopes replaced the two blanket features
    // here (migration `104`, 2026-11-14) -- see getAccessibleClasses's
    // own doc comment. "Can teach" now means the resolved class list
    // actually contains at least one class of that kind.
    getAccessibleClasses(user.id, profile?.features, profile?.personId),
  ]);
  const attendsMeetings = visibleMeetingTypes.length > 0;
  const canTeachYouth = accessibleTeachingClasses.some((c) => (TEACHING_CLASSES as readonly string[]).includes(c));
  const canTeachAdult = accessibleTeachingClasses.some((c) =>
    (ADULT_TEACHING_CLASSES as readonly string[]).includes(c),
  );

  // "My meetings" always shows now, for any signed-in account at all
  // (2026-11-08, replacing the Youth/Adult teaching-schedule links
  // this section gained 2026-11-08 the first time around) -- the user's
  // own request: "YM/YW Lessons" and "Relief Society & Priesthood
  // [Elders Quorum] Lessons" are plain, read-only date/topic/teacher
  // views, open to "logged in youth and adults" generally, not scoped
  // to a calling or a `youth_class_teachers` assignment the way editing
  // is. These are genuinely different, brand-new pages
  // (`/ym-yw-lessons`, `/adult-teaching-lessons`) from the real
  // Planning pages below -- not the same destination with different
  // labels -- so a teacher who ALSO has edit rights sees both: their
  // own read-only schedule here, and the editable grid under "My
  // calling".
  {
    const links: NavLink[] = [
      { title: "YM/YW Lessons", href: "/ym-yw-lessons" },
      { title: "Elders Quorum / Relief Society Lessons", href: "/adult-teaching-lessons" },
      ...visibleMeetingTypes.map((slug) => ({
        title: MEETING_TYPE_LABELS[slug],
        href: `/dashboard?type=${slug}`,
      })),
    ];
    if (attendsMeetings) links.push({ title: "Meeting Agenda Items", href: "/submit/agenda-item" });
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
  // "My calling," renamed from "Meeting Planning" (2026-11-08, the
  // user's own request) -- also gains YM/YW Teaching Planning
  // (renamed from "Youth Teaching Planning" the same day, 2026-11-08,
  // per the user's own new naming) alongside the Elders Quorum/Relief
  // Society Teaching tile that was already here: both teaching tools'
  // own broader, edit-capable planning view (for whoever actually
  // teaches, or for Bishopric/YW Presidency managing every class) lives
  // here -- genuinely gated by the real planning feature (and, for
  // youth, a real `youth_class_teachers` assignment), unlike the new
  // read-only "Lessons" links under "My meetings" above, which are open
  // to anyone signed in.
  if (canMeetingPlanningHub || canCallingPlanning || isMusicPlanner || canTeachYouth || canTeachAdult) {
    const links: NavLink[] = [];
    if (canMeetingPlanningHub) links.push({ title: "Meeting Planning", href: "/meeting-planning" });
    if (canCallingPlanning) links.push({ title: "Calling Planning", href: "/calling-planning" });
    if (isMusicPlanner) links.push({ title: "Sacrament Meeting Music Planning", href: "/music" });
    if (canTeachYouth) links.push({ title: "YM/YW Teaching Planning", href: "/youth-teaching-planning" });
    if (canTeachAdult) links.push({ title: "Elders Quorum / Relief Society Teaching", href: "/adult-teaching-planning" });
    sections.push({ title: "My calling", links });
  }

  const isYouthLeader = hasFeature(profile, "youth_activity_planning");
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
