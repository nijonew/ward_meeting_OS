import Link from "next/link";
import { redirect } from "next/navigation";
import { getMeetingById } from "@/lib/data/meetings";
import { getSacramentPlanningData } from "@/lib/data/sacrament-planning";
import { getActivePeople } from "@/lib/data/people";
import { getActiveCallings } from "@/lib/data/callings";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { RabnmSection } from "@/components/planning/RabnmSection";

/**
 * Ward Business, on its own page (2026-09-09, the user's own request:
 * "Handle the RABNM in its own separate page"). The main agenda grid's
 * Ward Business line is now just a banner with a link here -- "a fixed
 * line without any field, as it is somewhat its own section of the
 * meeting" (the user's own words) -- since RabnmSection's own add/
 * remove forms can't be real <form>s nested inside the agenda grid's
 * single big <form> (HTML forbids nested forms) anyway.
 *
 * Content is unchanged from the RabnmSection that used to render at the
 * bottom of the planning view -- only its position (its own page now,
 * linked from the Ward Business line, instead of a section stacked
 * below everything else) and title changed.
 */
export default async function WardBusinessPage({
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

  const [sacramentData, people, callings] = await Promise.all([
    getSacramentPlanningData(meetingId),
    getActivePeople(),
    getActiveCallings(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/meetings/${meetingId}/planning`} className="text-xs text-ink-muted hover:text-ink">
        &larr; Planning
      </Link>
      <RabnmSection
        meetingId={meetingId}
        items={sacramentData.rabnm}
        people={people}
        callings={callings}
        canEdit={isAdmin}
      />
    </div>
  );
}
