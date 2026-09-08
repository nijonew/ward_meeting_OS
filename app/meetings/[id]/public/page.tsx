import { getPublicSacramentView } from "@/lib/data/public-view";
import { getMeetingById } from "@/lib/data/meetings";
import { getSessionUser } from "@/lib/supabase/get-session-user";

export default async function PublicViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;

  // No login required here by design (this is the actual public
  // program) -- but it had no stage check at all, meaning the same
  // data would come back even for a meeting still in template/
  // planning/review, or one that's since been archived (the Vision
  // workflow calls archived Sacrament Meetings admin-only, "no
  // calling-based *or* public access at all once archived"). Admins
  // still need to preview this at any stage while building it, so this
  // only restricts everyone else, added 2026-09-08.
  const { profile } = await getSessionUser();
  if (profile?.role !== "bishopric") {
    const meeting = await getMeetingById(meetingId);
    if (!meeting || !["ready", "live"].includes(meeting.stage)) {
      return <p className="text-slate">This program isn&rsquo;t available right now.</p>;
    }
  }

  const view = await getPublicSacramentView(meetingId);

  if (!view) {
    return <p className="text-slate">Could not load this meeting.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {view.items.map((item, i) => (
        <div
          key={i}
          className="flex items-baseline justify-between gap-4 border-b border-rule/40 py-2 last:border-0"
        >
          <span className="text-ink">{item.heading}</span>
          {item.detail && <span className="text-right text-slate">{item.detail}</span>}
        </div>
      ))}
    </div>
  );
}
