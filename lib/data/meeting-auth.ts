import { getMeetingById } from "@/lib/data/meetings";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { meetingFeature, type MeetingFeatureAction } from "@/lib/data/meeting-features";

/**
 * Re-checks a signed-in account's own feature access for a specific
 * meeting, resolving that meeting's type first -- needed by every
 * Server Action that previously had NO authorization check at all
 * (saveBishopricMinutes, saveCouncilNotes, addActionItem,
 * toggleActionItem), which was safe only because the one and only UI
 * path that could reach any of them was Planning's own already-gated
 * form. Exposing a second path to those same four actions -- the
 * Archived page's new "Edit Notes" unlock, 2026-11-05 -- means they
 * now need their own re-check, matching every other action in this
 * app that's reachable from more than one gated entry point.
 *
 * **Not a fix for every action in `bishopric-actions.ts`** --
 * `saveBishopricAssignments`/`setAgendaItemStatus`/
 * `assignAgendaItemToMeeting` have the identical pre-existing gap but
 * aren't newly exposed by this change, so they're flagged here rather
 * than fixed as a drive-by; a real, separate security pass would be
 * needed to close all of them at once.
 */
export async function requireMeetingFeature(
  meetingId: string,
  action: MeetingFeatureAction
): Promise<{ error: string } | null> {
  const { profile } = await getSessionUser();
  const meeting = await getMeetingById(meetingId);
  if (!meeting) return { error: "Could not find this meeting." };
  if (!hasFeature(profile, meetingFeature(meeting.meetingType, action))) {
    return { error: "Not authorized." };
  }
  return null;
}
