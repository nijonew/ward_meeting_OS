import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getCallingDetail, getCallingPlanningHistory } from "@/lib/data/calling-planning";
import { getActivePeople } from "@/lib/data/people";
import { getUpcomingMeetings } from "@/lib/data/meetings";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { startCallingPlanning } from "@/app/callings/actions";
import { CallingPlanningCard } from "@/components/callings/CallingPlanningCard";

export default async function CallingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: callingId } = await params;
  const { error } = await searchParams;

  const { user, profile } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Callings" />
        <p className="mt-10 text-slate">Only the Bishopric can manage callings.</p>
      </main>
    );
  }

  const calling = await getCallingDetail(callingId);
  if (!calling) {
    return <p className="text-slate">Could not find that calling.</p>;
  }

  const [history, people, meetings] = await Promise.all([
    getCallingPlanningHistory(callingId),
    getActivePeople(),
    getUpcomingMeetings(),
  ]);

  const sacramentMeetings = meetings.filter((m) => m.meetingType === "sacrament-meeting");

  const start = async () => {
    "use server";
    await startCallingPlanning(callingId);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Callings" />

      <div className="rounded-lg border border-rule bg-card p-6 sm:p-8">
        <h1 className="font-display text-3xl leading-tight">
          {calling.title_prefix ? `${calling.title_prefix} ` : ""}
          {calling.name}
        </h1>
        <p className="mt-1 text-slate">
          Current holder: {calling.current_holder_name ?? "Vacant"}
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <form action={start} className="mt-4">
          <button
            type="submit"
            className="rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:bg-ink/5"
          >
            Start New Planning Process
          </button>
        </form>
      </div>

      {history.length === 0 ? (
        <p className="text-slate">No planning started yet for this calling.</p>
      ) : (
        history.map((planning) => (
          <CallingPlanningCard
            key={planning.id}
            callingId={callingId}
            planning={planning}
            people={people}
            upcomingSacramentMeetings={sacramentMeetings}
          />
        ))
      )}
    </main>
  );
}