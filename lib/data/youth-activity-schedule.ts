import { createClient } from "@/lib/supabase/server";
import { candidateDatesForCadence, readCadenceFields, type CadenceShape } from "@/lib/data/cadence";

export interface YouthActivityScheduleRule {
  id: string;
  cadence: CadenceShape;
  nth_occurrence: number | null;
  day_of_week: number | null;
  anchor_nth_occurrence: number | null;
  anchor_day_of_week: number | null;
  offset_days: number | null;
  activity_time: string | null;
  title: string;
  group_name: string;
  development_category: string | null;
  location: string | null;
  active: boolean;
}

export async function getYouthActivityScheduleRules(): Promise<YouthActivityScheduleRule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("youth_activity_schedule_rules")
    .select(
      "id, cadence, nth_occurrence, day_of_week, anchor_nth_occurrence, anchor_day_of_week, offset_days, activity_time, title, group_name, development_category, location, active"
    )
    .order("group_name");

  return (data ?? []) as YouthActivityScheduleRule[];
}

type ActionResult = { success: true } | { error: string };

function readRuleFields(formData: FormData) {
  const cadenceFields = readCadenceFields(formData);
  if ("error" in cadenceFields) return cadenceFields;

  const title = String(formData.get("title") ?? "").trim();
  const group_name = String(formData.get("group_name") ?? "");
  if (!title || !group_name) {
    return { error: "Title and group are required." };
  }

  const activity_time = String(formData.get("activity_time") ?? "") || null;
  const development_category = String(formData.get("development_category") ?? "") || null;
  const location = String(formData.get("location") ?? "").trim() || null;

  return { ...cadenceFields, title, group_name, activity_time, development_category, location };
}

export async function addYouthActivityScheduleRule(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const fields = readRuleFields(formData);
  if ("error" in fields) return fields;

  const { error } = await supabase.from("youth_activity_schedule_rules").insert(fields);
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateYouthActivityScheduleRule(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const fields = readRuleFields(formData);
  if ("error" in fields) return fields;

  const { error } = await supabase.from("youth_activity_schedule_rules").update(fields).eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteYouthActivityScheduleRule(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("youth_activity_schedule_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function toggleYouthActivityScheduleRuleActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("youth_activity_schedule_rules").update({ active: !active }).eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export interface GenerateResult {
  created: number;
  skippedExisting: number;
}

/**
 * For every active rule, computes matching dates from today through
 * throughDateISO (inclusive), creates any youth_activities rows that
 * don't already exist for that rule's title + group on that date.
 * Matches the exact pattern of generateMeetingsFromRules
 * (lib/data/meeting-schedule.ts) -- safe to re-run, existing rows are
 * never duplicated. Published immediately, matching how a manually
 * added activity is published immediately (see
 * app/youth-activities/actions.ts).
 */
export async function generateYouthActivitiesFromRules(throughDateISO: string): Promise<GenerateResult | { error: string }> {
  const supabase = await createClient();

  const rules = (await getYouthActivityScheduleRules()).filter((r) => r.active);
  if (rules.length === 0) return { created: 0, skippedExisting: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const through = new Date(`${throughDateISO}T00:00:00`);
  if (through < today) return { error: "The end date must be in the future." };

  let created = 0;
  let skippedExisting = 0;

  for (const rule of rules) {
    const candidateDates = candidateDatesForCadence(today, through, rule.cadence, rule);
    if (candidateDates.length === 0) continue;

    const { data: existing } = await supabase
      .from("youth_activities")
      .select("activity_date")
      .eq("title", rule.title)
      .eq("group_name", rule.group_name)
      .in("activity_date", candidateDates);
    const existingDates = new Set(((existing ?? []) as { activity_date: string }[]).map((a) => a.activity_date));

    const toCreate = candidateDates.filter((d) => !existingDates.has(d));
    skippedExisting += candidateDates.length - toCreate.length;
    if (toCreate.length === 0) continue;

    const { error } = await supabase.from("youth_activities").insert(
      toCreate.map((activity_date) => ({
        activity_date,
        activity_time: rule.activity_time,
        title: rule.title,
        group_name: rule.group_name,
        development_category: rule.development_category,
        location: rule.location,
        status: "published",
      }))
    );

    if (error) return { error: error.message };
    created += toCreate.length;
  }

  return { created, skippedExisting };
}
