import { createClient } from "@/lib/supabase/server";
import type { MeetingTypeSlug } from "@/lib/types";
import { weeklyDates } from "@/lib/data/cadence";
import { ALL_TEACHING_CLASS_OPTIONS } from "@/lib/data/teaching-assignments";

export interface MeetingCancellationRow {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  meeting_type_slugs: MeetingTypeSlug[];
  cancel_youth_activities: boolean;
  /** Second-hour class cancellations (2026-11-14) -- cancels every
   *  YM/YW and adult (Elders Quorum/Relief Society) class's own Sunday
   *  teaching_assignments row for this date range, independent of
   *  whether any meeting type is also checked -- the user's own
   *  example: "on certain sundays sacrament meeting is held but no
   *  second hour classes." */
  cancel_second_hour_classes: boolean;
}

export async function getMeetingCancellations(): Promise<MeetingCancellationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meeting_cancellations")
    .select("id, start_date, end_date, reason, meeting_type_slugs, cancel_youth_activities, cancel_second_hour_classes")
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
  const cancelSecondHourClasses = formData.get("cancel_second_hour_classes") === "on";

  if (!startDate || !endDate || !reason) {
    return { error: "Date range and a reason are required." };
  }
  if (endDate < startDate) {
    return { error: "End date can't be before start date." };
  }
  if (meetingTypeSlugs.length === 0 && !cancelYouthActivities && !cancelSecondHourClasses) {
    return { error: "Choose at least one meeting type, cancel youth activities, or cancel second-hour classes." };
  }

  const { error } = await supabase.from("meeting_cancellations").insert({
    start_date: startDate,
    end_date: endDate,
    reason,
    meeting_type_slugs: meetingTypeSlugs,
    cancel_youth_activities: cancelYouthActivities,
    cancel_second_hour_classes: cancelSecondHourClasses,
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
 *
 * Every row's update(s) run in parallel (2026-10-07, found alongside
 * the much larger auto-archive fix while chasing a general "app is
 * extremely slow" report) -- each one is independent (a different
 * cancellation row, scoped by its own date range), so there's no
 * reason to pay for them one at a time; `getMeetingCancellations` and
 * the `meeting_types` lookup were already the only two round trips
 * before any of them even start.
 *
 * **Gained a third target, `cancel_second_hour_classes`, 2026-11-14**
 * -- same "only ever ADDS, never auto-reverses" rule as the other two,
 * but routed through `applySecondHourClassCancellations` below rather
 * than inlined here: unlike `meetings`/`youth_activities` (which
 * already have a row for every relevant date before this sweep ever
 * runs, via their own auto-generation), `teaching_assignments` is a
 * genuinely sparse table -- a blank cell just means no row exists yet
 * -- so marking a date cancelled when nothing was ever saved for it
 * means INSERTING a brand-new placeholder row, not just updating one
 * that's assumed to already be there. That needs a read-then-split
 * step the simple `.update().eq("cancelled", false)` one-liners above
 * don't.
 */
export async function sweepMeetingCancellations(): Promise<void> {
  const supabase = await createClient();
  const cancellations = await getMeetingCancellations();
  if (cancellations.length === 0) return;

  const { data: typeRows } = await supabase.from("meeting_types").select("id, slug");
  const typeIdBySlug = new Map(((typeRows ?? []) as { id: string; slug: string }[]).map((t) => [t.slug, t.id]));

  const simpleUpdates = cancellations.flatMap((c) => {
    const updates: PromiseLike<unknown>[] = [];

    if (c.meeting_type_slugs.length > 0) {
      const typeIds = c.meeting_type_slugs.map((slug) => typeIdBySlug.get(slug)).filter((id): id is string => Boolean(id));
      if (typeIds.length > 0) {
        updates.push(
          supabase
            .from("meetings")
            .update({ cancelled: true, cancellation_note: c.reason })
            .gte("date", c.start_date)
            .lte("date", c.end_date)
            .in("meeting_type_id", typeIds)
            .eq("cancelled", false)
        );
      }
    }

    if (c.cancel_youth_activities) {
      updates.push(
        supabase
          .from("youth_activities")
          .update({ cancelled: true, cancellation_note: c.reason })
          .gte("activity_date", c.start_date)
          .lte("activity_date", c.end_date)
          .eq("cancelled", false)
      );
    }

    return updates;
  });

  const secondHourCancellations = cancellations.filter((c) => c.cancel_second_hour_classes);

  await Promise.all([...simpleUpdates, applySecondHourClassCancellations(supabase, secondHourCancellations)]);
}

/**
 * The read-then-split half `sweepMeetingCancellations` can't express
 * as a plain `.update()` -- see that function's own comment for why.
 * Runs each cancellation row's own date range sequentially (not
 * `Promise.all`, unlike the simple updates above) since every Sunday
 * in range needs its own read-then-decide step first; in practice this
 * list is always short (a handful of cancellation entries at most).
 *
 * Every Sunday in range (5th Sundays included -- unlike migration
 * 105's own topic pre-fill, there's no reason to treat a cancelled 5th
 * Sunday any differently; if the whole second hour is off, so is that
 * week's combined lesson) x every real class, youth and adult alike
 * (`ALL_TEACHING_CLASS_OPTIONS`, 2 adult + 6 youth):
 * - A row already exists and isn't cancelled yet -> update it in
 *   place, preserving whatever teacher/topic it already has.
 * - No row exists at all -> insert a brand-new one, cancelled, with no
 *   teacher/topic -- there's nothing to preserve.
 * An already-cancelled row is left alone either way, matching this
 * app's "only ever adds, never auto-reverses" rule for every other
 * cancellation sweep.
 */
async function applySecondHourClassCancellations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cancellations: MeetingCancellationRow[]
): Promise<void> {
  const classNames = ALL_TEACHING_CLASS_OPTIONS.map((c) => c.value);

  for (const c of cancellations) {
    const sundays = weeklyDates(new Date(`${c.start_date}T00:00:00`), new Date(`${c.end_date}T00:00:00`), 0);
    if (sundays.length === 0) continue;

    const { data } = await supabase
      .from("teaching_assignments")
      .select("id, class_date, class_name, cancelled")
      .in("class_date", sundays)
      .in("class_name", classNames);

    const existing = new Map<string, { id: string; cancelled: boolean }>();
    for (const row of (data ?? []) as { id: string; class_date: string; class_name: string; cancelled: boolean }[]) {
      existing.set(`${row.class_date}::${row.class_name}`, { id: row.id, cancelled: row.cancelled });
    }

    const updateIds: string[] = [];
    const inserts: { class_date: string; class_name: string }[] = [];

    for (const classDate of sundays) {
      for (const className of classNames) {
        const row = existing.get(`${classDate}::${className}`);
        if (row) {
          if (!row.cancelled) updateIds.push(row.id);
        } else {
          inserts.push({ class_date: classDate, class_name: className });
        }
      }
    }

    await Promise.all([
      updateIds.length > 0
        ? supabase.from("teaching_assignments").update({ cancelled: true, cancellation_note: c.reason }).in("id", updateIds)
        : null,
      inserts.length > 0
        ? supabase.from("teaching_assignments").insert(
            inserts.map((row) => ({ ...row, cancelled: true, cancellation_note: c.reason }))
          )
        : null,
    ]);
  }
}
