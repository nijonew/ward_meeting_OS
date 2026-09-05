import { createClient } from "@/lib/supabase/server";
import { applyRotationsToNewMeeting } from "@/lib/data/rotations";

export interface ScheduleRule {
  id: string;
  meeting_type_id: string;
  meeting_type_slug: string;
  meeting_type_name: string;
  cadence: "weekly" | "nth_weekday" | "relative";
  nth_occurrence: number | null;
  day_of_week: number | null; // 0=Sunday..6=Saturday
  anchor_nth_occurrence: number | null;
  anchor_day_of_week: number | null;
  offset_days: number | null;
  time_of_day: string; // "HH:MM:SS"
  duration_minutes: number;
  active: boolean;
}

export async function getScheduleRules(): Promise<ScheduleRule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meeting_schedule_rules")
    .select(
      "id, meeting_type_id, cadence, nth_occurrence, day_of_week, anchor_nth_occurrence, anchor_day_of_week, offset_days, time_of_day, duration_minutes, active, meeting_types(slug, name)"
    )
    .order("cadence");

  return ((data ?? []) as unknown[]).map((row) => {
    const r = row as {
      id: string;
      meeting_type_id: string;
      cadence: "weekly" | "nth_weekday" | "relative";
      nth_occurrence: number | null;
      day_of_week: number | null;
      anchor_nth_occurrence: number | null;
      anchor_day_of_week: number | null;
      offset_days: number | null;
      time_of_day: string;
      duration_minutes: number;
      active: boolean;
      meeting_types: { slug?: string; name?: string }[] | { slug?: string; name?: string } | null;
    };
    const meetingType = Array.isArray(r.meeting_types) ? r.meeting_types[0] : r.meeting_types;
    return {
      id: r.id,
      meeting_type_id: r.meeting_type_id,
      meeting_type_slug: meetingType?.slug ?? "",
      meeting_type_name: meetingType?.name ?? "Meeting",
      cadence: r.cadence,
      nth_occurrence: r.nth_occurrence,
      day_of_week: r.day_of_week,
      anchor_nth_occurrence: r.anchor_nth_occurrence,
      anchor_day_of_week: r.anchor_day_of_week,
      offset_days: r.offset_days,
      time_of_day: r.time_of_day,
      duration_minutes: r.duration_minutes,
      active: r.active,
    };
  });
}

type ActionResult = { success: true } | { error: string };

/** Reads and validates the cadence-dependent fields shared by add and update. */
function readRuleFields(formData: FormData):
  | {
      cadence: string;
      time_of_day: string;
      duration_minutes: number;
      day_of_week: number | null;
      nth_occurrence: number | null;
      anchor_day_of_week: number | null;
      anchor_nth_occurrence: number | null;
      offset_days: number | null;
    }
  | { error: string } {
  const cadence = String(formData.get("cadence") ?? "");
  const time_of_day = String(formData.get("time_of_day") ?? "");
  const duration_minutes = Number(formData.get("duration_minutes"));

  if (!cadence || !time_of_day || !duration_minutes) {
    return { error: "All fields are required." };
  }

  let day_of_week: number | null = null;
  let nth_occurrence: number | null = null;
  let anchor_day_of_week: number | null = null;
  let anchor_nth_occurrence: number | null = null;
  let offset_days: number | null = null;

  if (cadence === "weekly") {
    const raw = formData.get("day_of_week");
    if (raw === null || raw === "") return { error: "Choose a day of the week." };
    day_of_week = Number(raw);
  } else if (cadence === "nth_weekday") {
    const dayRaw = formData.get("day_of_week");
    const nthRaw = formData.get("nth_occurrence");
    if (dayRaw === null || dayRaw === "") return { error: "Choose a day of the week." };
    if (nthRaw === null || nthRaw === "") return { error: "Choose 1st through 5th." };
    day_of_week = Number(dayRaw);
    nth_occurrence = Number(nthRaw);
  } else if (cadence === "relative") {
    const anchorDayRaw = formData.get("anchor_day_of_week");
    const anchorNthRaw = formData.get("anchor_nth_occurrence");
    const offsetRaw = formData.get("offset_days");
    if (anchorDayRaw === null || anchorDayRaw === "") return { error: "Choose the anchor day of the week." };
    if (anchorNthRaw === null || anchorNthRaw === "") return { error: "Choose the anchor's 1st through 5th." };
    if (offsetRaw === null || offsetRaw === "") return { error: "Enter a day offset." };
    anchor_day_of_week = Number(anchorDayRaw);
    anchor_nth_occurrence = Number(anchorNthRaw);
    offset_days = Number(offsetRaw);
  } else {
    return { error: "Unknown cadence." };
  }

  return {
    cadence,
    time_of_day,
    duration_minutes,
    day_of_week,
    nth_occurrence,
    anchor_day_of_week,
    anchor_nth_occurrence,
    offset_days,
  };
}

export async function addScheduleRule(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const meetingTypeSlug = String(formData.get("meeting_type_id") ?? "");
  if (!meetingTypeSlug) return { error: "Choose a meeting type." };

  const fields = readRuleFields(formData);
  if ("error" in fields) return fields;

  const { data: meetingType } = await supabase
    .from("meeting_types")
    .select("id")
    .eq("slug", meetingTypeSlug)
    .single();
  if (!meetingType) return { error: "Unknown meeting type." };

  const { error } = await supabase.from("meeting_schedule_rules").insert({
    meeting_type_id: meetingType.id,
    ...fields,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateScheduleRule(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const meetingTypeSlug = String(formData.get("meeting_type_id") ?? "");
  if (!meetingTypeSlug) return { error: "Choose a meeting type." };

  const fields = readRuleFields(formData);
  if ("error" in fields) return fields;

  const { data: meetingType } = await supabase
    .from("meeting_types")
    .select("id")
    .eq("slug", meetingTypeSlug)
    .single();
  if (!meetingType) return { error: "Unknown meeting type." };

  const { error } = await supabase
    .from("meeting_schedule_rules")
    .update({ meeting_type_id: meetingType.id, ...fields })
    .eq("id", id);

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

/** The Nth occurrence of dayOfWeek in the given month, or null if that month doesn't have one (e.g. no 5th). */
function nthOccurrenceInMonth(year: number, month: number, dayOfWeek: number, nth: number): Date | null {
  const matches: Date[] = [];
  for (let day = 1; day <= 31; day++) {
    const candidate = new Date(year, month, day);
    if (candidate.getMonth() !== month) break; // ran past end of month
    if (candidate.getDay() === dayOfWeek) matches.push(candidate);
  }
  return matches[nth - 1] ?? null;
}

/** The Nth occurrence of day_of_week in each month between start and end (inclusive). */
function nthWeekdayDates(start: Date, end: Date, dayOfWeek: number, nth: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last) {
    const picked = nthOccurrenceInMonth(cursor.getFullYear(), cursor.getMonth(), dayOfWeek, nth);
    if (picked && picked >= start && picked <= end) {
      dates.push(toISODate(picked));
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return dates;
}

/**
 * Dates computed as "offsetDays days after (or before, if negative) the
 * Nth occurrence of anchorDayOfWeek" in each month -- e.g. "2 days after
 * the 3rd Sunday" (the Tuesday that follows it, whichever numbered
 * Tuesday that happens to be that month). Iterates one month of padding
 * on each side of the range so an offset that crosses a month boundary
 * still gets caught.
 */
function relativeDates(
  start: Date,
  end: Date,
  anchorDayOfWeek: number,
  anchorNth: number,
  offsetDays: number
): string[] {
  const dates: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const last = new Date(end.getFullYear(), end.getMonth() + 1, 1);

  while (cursor <= last) {
    const anchor = nthOccurrenceInMonth(cursor.getFullYear(), cursor.getMonth(), anchorDayOfWeek, anchorNth);
    if (anchor) {
      const candidate = new Date(anchor);
      candidate.setDate(candidate.getDate() + offsetDays);
      if (candidate >= start && candidate <= end) {
        dates.push(toISODate(candidate));
      }
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
    let candidateDates: string[];
    if (rule.cadence === "weekly") {
      candidateDates = weeklyDates(today, through, rule.day_of_week ?? 0);
    } else if (rule.cadence === "nth_weekday") {
      candidateDates = nthWeekdayDates(today, through, rule.day_of_week ?? 0, rule.nth_occurrence ?? 1);
    } else {
      candidateDates = relativeDates(
        today,
        through,
        rule.anchor_day_of_week ?? 0,
        rule.anchor_nth_occurrence ?? 1,
        rule.offset_days ?? 0
      );
    }

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
