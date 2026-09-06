import { createClient } from "@/lib/supabase/server";
import { applyRotationsToNewMeeting } from "@/lib/data/rotations";
import { seedPlannedElementsForMeeting } from "@/lib/data/meeting-elements";
import { candidateDatesForCadence, readCadenceFields } from "@/lib/data/cadence";

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

/** Adds this rule type's own fields (time/duration) on top of the shared cadence fields. */
function readRuleFields(formData: FormData) {
  const cadenceFields = readCadenceFields(formData);
  if ("error" in cadenceFields) return cadenceFields;

  const time_of_day = String(formData.get("time_of_day") ?? "");
  const duration_minutes = Number(formData.get("duration_minutes"));
  if (!time_of_day || !duration_minutes) {
    return { error: "All fields are required." };
  }

  return { ...cadenceFields, time_of_day, duration_minutes };
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
    const candidateDates = candidateDatesForCadence(today, through, rule.cadence, rule);
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
    const isSacrament = slug === "sacrament-meeting";

    for (const row of (inserted ?? []) as { id: string }[]) {
      // Bulk-generated meetings always start as "standard" -- cadence
      // rules can't know about a future Stake Conference/General
      // Conference Sunday; the user corrects special_format manually
      // (via Meeting Info) for whichever real Sundays need it.
      if (isSacrament) {
        await supabase.from("sacrament_planning").insert({ meeting_id: row.id, special_format: "standard" });
      }
      await applyRotationsToNewMeeting(row.id, rule.meeting_type_id, slug);
      await seedPlannedElementsForMeeting(row.id, rule.meeting_type_id, isSacrament ? "standard" : null);
      created += 1;
    }
  }

  return { created, skippedExisting };
}
