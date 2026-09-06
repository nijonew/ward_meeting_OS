import { createClient } from "@/lib/supabase/server";
import { candidateDatesForCadence, readCadenceFields, type CadenceShape } from "@/lib/data/cadence";

export interface WardEventScheduleRule {
  id: string;
  cadence: CadenceShape;
  nth_occurrence: number | null;
  day_of_week: number | null;
  anchor_nth_occurrence: number | null;
  anchor_day_of_week: number | null;
  offset_days: number | null;
  event_time: string | null;
  title: string;
  location: string | null;
  active: boolean;
}

export async function getWardEventScheduleRules(): Promise<WardEventScheduleRule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ward_event_schedule_rules")
    .select(
      "id, cadence, nth_occurrence, day_of_week, anchor_nth_occurrence, anchor_day_of_week, offset_days, event_time, title, location, active"
    )
    .order("title");

  return (data ?? []) as WardEventScheduleRule[];
}

type ActionResult = { success: true } | { error: string };

function readRuleFields(formData: FormData) {
  const cadenceFields = readCadenceFields(formData);
  if ("error" in cadenceFields) return cadenceFields;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return { error: "Title is required." };
  }

  const event_time = String(formData.get("event_time") ?? "") || null;
  const location = String(formData.get("location") ?? "").trim() || null;

  return { ...cadenceFields, title, event_time, location };
}

export async function addWardEventScheduleRule(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const fields = readRuleFields(formData);
  if ("error" in fields) return fields;

  const { error } = await supabase.from("ward_event_schedule_rules").insert(fields);
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateWardEventScheduleRule(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const fields = readRuleFields(formData);
  if ("error" in fields) return fields;

  const { error } = await supabase.from("ward_event_schedule_rules").update(fields).eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteWardEventScheduleRule(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("ward_event_schedule_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function toggleWardEventScheduleRuleActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("ward_event_schedule_rules").update({ active: !active }).eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export interface GenerateResult {
  created: number;
  skippedExisting: number;
}

/**
 * For every active rule, computes matching dates from today through
 * throughDateISO (inclusive), creates any ward_events rows that don't
 * already exist for that rule's title on that date. Matches the exact
 * pattern of generateMeetingsFromRules (lib/data/meeting-schedule.ts)
 * -- safe to re-run, existing rows are never duplicated. Published
 * immediately, matching how a manually added event is published
 * immediately (see app/ward-events/actions.ts).
 */
export async function generateWardEventsFromRules(throughDateISO: string): Promise<GenerateResult | { error: string }> {
  const supabase = await createClient();

  const rules = (await getWardEventScheduleRules()).filter((r) => r.active);
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
      .from("ward_events")
      .select("event_date")
      .eq("title", rule.title)
      .in("event_date", candidateDates);
    const existingDates = new Set(((existing ?? []) as { event_date: string }[]).map((e) => e.event_date));

    const toCreate = candidateDates.filter((d) => !existingDates.has(d));
    skippedExisting += candidateDates.length - toCreate.length;
    if (toCreate.length === 0) continue;

    const { error } = await supabase.from("ward_events").insert(
      toCreate.map((event_date) => ({
        event_date,
        event_time: rule.event_time,
        title: rule.title,
        location: rule.location,
        status: "published",
      }))
    );

    if (error) return { error: error.message };
    created += toCreate.length;
  }

  return { created, skippedExisting };
}
