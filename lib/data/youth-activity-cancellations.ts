import { createClient } from "@/lib/supabase/server";

export interface YouthActivityCancellationRow {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  group_names: string[];
}

export async function getYouthActivityCancellations(): Promise<YouthActivityCancellationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("youth_activity_cancellations")
    .select("id, start_date, end_date, reason, group_names")
    .order("start_date", { ascending: false });
  return (data ?? []) as YouthActivityCancellationRow[];
}

type ActionResult = { success: true } | { error: string };

export async function addYouthActivityCancellation(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const groupNames = formData.getAll("group_names").map(String);

  if (!startDate || !endDate || !reason) {
    return { error: "Date range and a reason are required." };
  }
  if (endDate < startDate) {
    return { error: "End date can't be before start date." };
  }

  const { error } = await supabase.from("youth_activity_cancellations").insert({
    start_date: startDate,
    end_date: endDate,
    reason,
    group_names: groupNames,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteYouthActivityCancellation(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("youth_activity_cancellations").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Lazy sweep, same pattern as sweepMeetingCancellations -- runs on every
 * read of youth_activities (getYouthActivities) rather than once when a
 * cancellation is saved, so an activity added after a cancellation was
 * entered still gets caught. Only ever ADDS a cancellation (skips any
 * row already cancelled) -- never auto-reverses one.
 *
 * group_names empty means "every group" -- the common case for a
 * ward-wide holiday week. A non-empty list scopes the sweep to just
 * those groups (.in("group_name", ...)), for a cancellation that only
 * affects some classes/quorums.
 */
export async function sweepYouthActivityCancellations(): Promise<void> {
  const supabase = await createClient();
  const cancellations = await getYouthActivityCancellations();
  if (cancellations.length === 0) return;

  await Promise.all(
    cancellations.map((c) => {
      let query = supabase
        .from("youth_activities")
        .update({ cancelled: true, cancellation_note: c.reason })
        .gte("activity_date", c.start_date)
        .lte("activity_date", c.end_date)
        .eq("cancelled", false);
      if (c.group_names.length > 0) {
        query = query.in("group_name", c.group_names);
      }
      return query;
    })
  );
}
