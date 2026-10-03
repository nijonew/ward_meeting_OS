import Link from "next/link";
import { redirect } from "next/navigation";
import { getMeetingById } from "@/lib/data/meetings";
import { getMeetingWithType } from "@/lib/data/meeting-elements";
import { getVisitingAuthorities } from "@/lib/data/visiting-authorities";
import { getEligiblePeopleForElement } from "@/lib/data/rotations";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { VisitingAuthoritiesSection } from "@/components/planning/VisitingAuthoritiesSection";

/**
 * Visiting Authorities, on its own page (2026-10-03, the user's own
 * request) -- same reasoning and shape as /meetings/[id]/ward-business:
 * the main agenda grid's own Visiting Authorities line is now just a
 * banner with a link here, since VisitingAuthoritiesSection's own
 * add/remove forms can't nest inside the grid's single big `<form>`.
 */
export default async function VisitingAuthoritiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;

  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");
  const isAdmin = profile?.role === "bishopric";

  const meeting = await getMeetingById(meetingId);
  if (!meeting) {
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }
  if (meeting.stage === "archived") {
    redirect(`/meetings/${meetingId}/archived`);
  }

  const meetingWithType = await getMeetingWithType(meetingId);
  if (!meetingWithType) {
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }

  const [items, eligiblePeople] = await Promise.all([
    getVisitingAuthorities(meetingId),
    // Fixed by calling, not a real `rotations` row (see
    // VISITING_AUTHORITY_CALLING_NAMES's own comment) -- this always
    // returns a real list for Sacrament Meeting, never null, but the
    // fallback keeps this page safe if that ever changes.
    getEligiblePeopleForElement(meeting.meetingType, meetingWithType.meetingTypeId, "visiting_authorities"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/meetings/${meetingId}/planning`} className="text-xs text-ink-muted hover:text-ink">
        &larr; Planning
      </Link>
      <VisitingAuthoritiesSection
        meetingId={meetingId}
        items={items}
        people={eligiblePeople ?? []}
        canEdit={isAdmin}
      />
    </div>
  );
}
