import Link from "next/link";
import { redirect } from "next/navigation";
import { getMeetingById } from "@/lib/data/meetings";
import { getSacramentPlanningData } from "@/lib/data/sacrament-planning";
import { getActivePeople } from "@/lib/data/people";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getSacramentProgramItems, resolveProgramItems } from "@/lib/data/sacrament-program";
import { SacramentProgramSection } from "@/components/planning/SacramentProgramSection";

/**
 * Speakers & Music, on its own page (2026-09-09) -- see
 * SacramentProgramSection for the full writeup of why this is a
 * separate page rather than an inline part of the main agenda grid.
 */
export default async function SpeakersMusicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;

  const { user } = await getSessionUser();
  if (!user) redirect("/login");

  const meeting = await getMeetingById(meetingId);
  if (!meeting) {
    return <p className="text-slate">Could not load this meeting.</p>;
  }
  if (meeting.stage === "archived") {
    redirect(`/meetings/${meetingId}/archived`);
  }

  const [programItems, sacramentData, people] = await Promise.all([
    getSacramentProgramItems(meetingId),
    getSacramentPlanningData(meetingId),
    getActivePeople(),
  ]);

  const resolved = resolveProgramItems(
    programItems,
    sacramentData.music,
    sacramentData.speakersAdults,
    sacramentData.speakersYouth
  );

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/meetings/${meetingId}/planning`} className="text-xs text-slate hover:text-ink">
        &larr; Planning
      </Link>
      <SacramentProgramSection meetingId={meetingId} items={resolved} people={people} />
    </div>
  );
}
