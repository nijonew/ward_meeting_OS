import { redirect } from "next/navigation";
import { getConductingScript } from "@/lib/data/conducting";
import { getSessionUser } from "@/lib/supabase/get-session-user";

export default async function ConductingViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;

  const { user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const script = await getConductingScript(meetingId);

  if (!script) {
    return <p className="text-slate">Could not load this meeting.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {script.specialFormat !== "standard" && (
        <div className="rounded-md border border-brass/40 bg-card px-4 py-3 text-sm text-ink">
          This meeting is flagged as <strong>{script.specialFormat.replace(/_/g, " ")}</strong> —
          the standard script below may not fit. Read through it before the meeting and adjust as
          needed.
        </div>
      )}
      {script.lines.map((line, i) => (
        <div key={i}>
          <p className="font-mono text-[11px] uppercase tracking-widest text-slate/70">
            {line.heading}
          </p>
          {line.prompt && (
            <p className="mt-1 text-lg leading-relaxed text-ink sm:text-xl">{line.prompt}</p>
          )}
        </div>
      ))}
    </div>
  );
}