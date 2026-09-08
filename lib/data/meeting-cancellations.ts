import { createClient } from "@/lib/supabase/server";
import type { MeetingTypeSlug } from "@/lib/types";

export interface MeetingCancellationRow {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  meeting_type_slugs: MeetingTypeSlug[];
  cancel_youth_activities: boolean;
}

export async function getMeetingCancellations(): Promise<MeetingCancellationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meeting_cancellations")
    .select("id, start_date, end_date, reason, meeting_type_slugs, cancel_youth_activities")
    .order("start_date", { ascending: false });
  return (data ?? []) as MeetingCancellationRow[];
}

type ActionResult = { success: true } | { error: string };

export async function addMeetingCancellation(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const meetingTypeSlugs = formData.getAll("meeting_type_slugs").map(String);
  const cancelYouthActivities = formData.get("cancel_youth_activities") === "on";

  if (!startDate || !endDate || !reason) {
    return { error: "Date range and a reason are required." };
  }
  if (endDate < startDate) {
    return { error: "End date can't be before start date." };
  }
  if (meetingTypeSlugs.length === 0 && !cancelYouthActivities) {
    return { error: "Choose at least one meeting type, or cancel youth activities, or both." };
  }

  const { error } = await supabase.from("meeting_cancellations").insert({
    start_date: startDate,
    end_date: endDate,
    reason,
    meeting_type_slugs: meetingTypeSlugs,
    cancel_youth_activities: cancelYouthActivities,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteMeetingCancellation(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_cancellations").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Lazy sweep, same pattern as autoArchivePastMeetings
 * (lib/data/meetings.ts) -- no scheduled-job infrastructure exists in
 * this app, so this runs on every read of the affected lists
 * (getUpcomingMeetings, getYouthActivities) instead of once when a
 * cancellation is saved. That also means a meeting or activity added
 * *after* a cancellation was entered still gets caught.
 *
 * Only ever ADDS a cancellation (skips any row already cancelled) --
 * never auto-reverses one, even if a cancellation's dates are later
 * corrected or the row deleted. An admin can always manually un-cancel
 * a specific row via the existing per-row controls; this avoids having
 * to track "cancelled by which entry" just to know what's safe to undo
 * automatically.
 *
 * Generalized from an earlier General/Stake-Conference-specific design
 * (2026-09-06, the user's own follow-up): which meeting types (and
 * whether youth activities) get cancelled, and the exact date range
 * (a conference's "week leading up" included), is now entirely up to
 * what the admin entered on this row -- nothing about conferences is
 * hardcoded in this function at all.
 */
export async function sweepMeetingCancellations(): Promise<void> {
  const supabase = await createClient();
  const cancellations = await getMeetingCancellations();
  if (cancellations.length === 0) return;

  const { data: typeRows } = await supabase.from("meeting_types").select("id, slug");
  const typeIdBySlug = new Map(((typeRows ?? []) as { id: string; slug: string }[]).map((t) => [t.slug, t.id]));

  for (const c of cancellations) {
    if (c.meeting_type_slugs.length > 0) {
      const typeIds = c.meeting_type_slugs.map((slug) => typeIdBySlug.get(slug)).filter((id): id is string => Boolean(id));
      if (typeIds.length > 0) {
        await supabase
          .from("meetings")
          .update({ cancelled: true, cancellation_note: c.reason })
          .gte("date", c.start_date)
          .lte("date", c.end_date)
          .in("meeting_type_id", typeIds)
          .eq("cancelled", false);
      }
    }

    if (c.cancel_youth_activities) {
      await supabase
        .from("youth_activities")
        .update({ cancelled: true, cancellation_note: c.reason })
        .gte("activity_date", c.start_date)
        .lte("activity_date", c.end_date)
        .eq("cancelled", false);
    }
  }
}
