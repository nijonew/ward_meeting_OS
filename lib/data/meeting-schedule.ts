import { createClient } from "@/lib/supabase/server";
import { applyRotationsToNewMeeting } from "@/lib/data/rotations";

export interface ScheduleRule {
  id: string;
  meeting_type_id: string;
  meeting_type_name: string;
  cadence: "weekly" | "nth_weekday";
  nth_occurrence: number | null;
  day_of_week: number; // 0=Sunday..6=Saturday
  time_of_day: string; // "HH:MM:SS"
  duration_minutes: number;
  active: boolean;
}

export async function getScheduleRules(): Promise<ScheduleRule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meeting_schedule_rules")
    .select(
      "id, meeting_type_id, cadence, nth_occurrence, day_of_week, time_of_day, duration_minutes, active, meeting_types(name)"
    )
    .order("day_of_week");

  return ((data ?? []) as unknown[]).map((row) => {
    const r = row as {
      id: string;
      meeting_type_id: string;
      cadence: "weekly" | "nth_weekday";
      nth_occurrence: number | null;
      day_of_week: number;
      time_of_day: string;
      duration_minutes: number;
      active: boolean;
      meeting_types: { name?: string }[] | { name?: string } | null;
    };
    const meetingType = Array.isArray(r.meeting_types) ? r.meeting_types[0] : r.meeting_types;
    return {
      id: r.id,
      meeting_type_id: r.meeting_type_id,
      meeting_type_name: meetingType?.name ?? "Meeting",
      cadence: r.cadence,
      nth_occurrence: r.nth_occurrence,
      day_of_week: r.day_of_week,
      time_of_day: r.time_of_day,
      duration_minutes: r.duration_minutes,
      active: r.active,
    };
  });
}

type ActionResult = { success: true } | { error: string };

export async function addScheduleRule(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const meetingTypeSlug = String(formData.get("meeting_type_id") ?? "");
  const cadence = String(formData.get("cadence") ?? "");
  const nthRaw = String(formData.get("nth_occurrence") ?? "");
  const day_of_week = Number(formData.get("day_of_week"));
  const time_of_day = String(formData.get("time_of_day") ?? "");
  const duration_minutes = Number(formData.get("duration_minutes"));

  if (!meetingTypeSlug || !cadence || !time_of_day || !duration_minutes) {
    return { error: "All fields are required." };
  }
  if (cadence === "nth_weekday" && !nthRaw) {
    return { error: "Choose 1st through 5th for a monthly cadence." };
  }

  const { data: meetingType } = await supabase
    .from("meeting_types")
    .select("id")
    .eq("slug", meetingTypeSlug)
    .single();
  if (!meetingType) return { error: "Unknown meeting type." };

  const { error } = await supabase.from("meeting_schedule_rules").insert({
    meeting_type_id: meetingType.id,
    cadence,
    nth_occurrence: cadence === "nth_weekday" ? Number(nthRaw) : null,
    day_of_week,
    time_of_day,
    duration_minutes,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteScheduleRule(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_schedule_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function toggleScheduleRuleActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_schedule_rules").update({ active: !active }).eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** All dates matching day_of_week between start and end (inclusive), for a 'weekly' rule. */
function weeklyDates(start: Date, end: Date, dayOfWeek: number): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
  while (d <= end) {
    dates.push(toISODate(d));
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

/** The Nth occurrence of day_of_week in each month between start and end (inclusive). */
function nthWeekdayDates(start: Date, end: Date, dayOfWeek: number, nth: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const matchesInMonth: Date[] = [];
    for (let day = 1; day <= 31; day++) {
      const candidate = new Date(year, month, day);
      if (candidate.getMonth() !== month) break; // ran past end of month
      if (candidate.getDay() === dayOfWeek) matchesInMonth.push(candidate);
    }
    const picked = matchesInMonth[nth - 1]; // undefined if month doesn't have a 5th, e.g.
    if (picked && picked >= start && picked <= end) {
      dates.push(toISODate(picked));
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return dates;
}

export interface GenerateResult {
  created: number;
  skippedExisting: number;
}

/**
 * For every active rule, computes matching dates from today through
 * `throughDateISO` (inclusive), creates any meeting rows that don't
 * already exist for that meeting type + date, and applies rotations to
 * each new meeting exactly as manual creation does. Safe to re-run --
 * existing dates are skipped, not duplicated.
 */
export async function generateMeetingsFromRules(throughDateISO: string): Promise<GenerateResult | { error: string }> {
  const supabase = await createClient();

  const rules = (await getScheduleRules()).filter((r) => r.active);
  if (rules.length === 0) return { created: 0, skippedExisting: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const through = new Date(`${throughDateISO}T00:00:00`);
  if (through < today) return { error: "The end date must be in the future." };

  const { data: typeRows } = await supabase.from("meeting_types").select("id, slug");
  const slugById = new Map(((typeRows ?? []) as { id: string; slug: string }[]).map((t) => [t.id, t.slug]));

  let created = 0;
  let skippedExisting = 0;

  for (const rule of rules) {
    const candidateDates =
      rule.cadence === "weekly"
        ? weeklyDates(today, through, rule.day_of_week)
        : nthWeekdayDates(today, through, rule.day_of_week, rule.nth_occurrence ?? 1);

    if (candidateDates.length === 0) continue;

    const { data: existing } = await supabase
      .from("meetings")
      .select("date")
      .eq("meeting_type_id", rule.meeting_type_id)
      .in("date", candidateDates);
    const existingDates = new Set(((existing ?? []) as { date: string }[]).map((m) => m.date));

    const toCreate = candidateDates.filter((d) => !existingDates.has(d));
    skippedExisting += candidateDates.length - toCreate.length;
    if (toCreate.length === 0) continue;

    const { data: inserted, error } = await supabase
      .from("meetings")
      .insert(
        toCreate.map((date) => ({
          meeting_type_id: rule.meeting_type_id,
          date,
          stage: "planning",
          time_of_day: rule.time_of_day,
          duration_minutes: rule.duration_minutes,
        }))
      )
      .select("id");

    if (error) return { error: error.message };

    const slug = slugById.get(rule.meeting_type_id) ?? "";
    for (const row of (inserted ?? []) as { id: string }[]) {
      await applyRotationsToNewMeeting(row.id, rule.meeting_type_id, slug);
      created += 1;
    }
  }

  return { created, skippedExisting };
}