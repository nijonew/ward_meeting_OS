import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getMeetingTypes } from "@/lib/data/meeting-types";
import { CreateMeetingForm } from "@/components/meetings/CreateMeetingForm";

export default async function NewMeetingPage() {
  const { user, profile } = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="New Meeting" />
        <p className="mt-10 text-slate">Only the Bishopric can create meetings.</p>
      </main>
    );
  }

  const meetingTypes = await getMeetingTypes();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="New Meeting" />

      <div className="rounded-lg border border-rule bg-card p-6">
        <h2 className="font-display text-xl">Create Meeting</h2>
        <p className="mt-1 text-xs text-slate">
          Pick a type and date. You&rsquo;ll land on that meeting&rsquo;s page once it&rsquo;s created.
        </p>
        <CreateMeetingForm meetingTypes={meetingTypes} />
      </div>
    </main>
  );
}