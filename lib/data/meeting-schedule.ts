import { createClient } from "@/lib/supabase/server";
import { applyRotationsToNewMeeting } from "@/lib/data/rotations";
import { seedPlannedElementsForMeeting } from "@/lib/data/meeting-elements";
import { seedSacramentProgramItemsForMeeting } from "@/lib/data/sacrament-program";
import { candidateDatesForCadence, readCadenceFields } from "@/lib/data/cadence";
import { getMountainTimeNow } from "@/lib/data/timezone";

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

  // Mountain Time, not the server's own UTC clock (2026-10-20 bugfix) --
  // a plain UTC "today" could shift the start of this candidate-date
  // window by a day for several hours each evening, same root cause as
  // lib/data/meetings.ts's autoArchivePastMeetings.
  const today = new Date(`${getMountainTimeNow().dateIso}T00:00:00`);
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
      // These four calls are independent of each other for one and the
      // same meeting -- none reads back what another just wrote -- so
      // they run as one parallel wave per row instead of four
      // sequential round trips (2026-10-31, chasing the user's own
      // "this app is extremely slow" report, which matters most right
      // here since a bulk Generate can create many meetings at once).
      // The outer loop itself still awaits each row before starting the
      // next, which is what actually matters for correctness --
      // applyRotationsToNewMeeting advances a shared rotation pointer
      // that two meetings of the same type can't safely race for, and
      // that's a cross-ROW constraint, not a within-row one.
      const sideEffects: PromiseLike<unknown>[] = [
        applyRotationsToNewMeeting(row.id, rule.meeting_type_id, slug),
        seedPlannedElementsForMeeting(row.id, rule.meeting_type_id, isSacrament ? "standard" : null),
      ];
      if (isSacrament) {
        // Bulk-generated meetings always start as "standard" -- cadence
        // rules can't know about a future Stake Conference/General
        // Conference Sunday; the user corrects special_format manually
        // (via Meeting Info) for whichever real Sundays need it.
        sideEffects.push(supabase.from("sacrament_planning").insert({ meeting_id: row.id, special_format: "standard" }));
        // Speakers & Music pre-fill by template (2026-09-10) -- same
        // "standard" default every bulk-generated meeting already gets
        // for special_format above.
        sideEffects.push(seedSacramentProgramItemsForMeeting(row.id, "standard"));
      }
      await Promise.all(sideEffects);
      created += 1;
    }
  }

  return { created, skippedExisting };
}

/** How far out automatic generation always keeps meetings covered --
 *  recomputed fresh on every call (via getMountainTimeNow), so the
 *  horizon keeps sliding forward as today advances. Matches this app's
 *  existing "today + ~2 months" default convention (see
 *  /youth-teaching-planning's own through-date default). */
const AUTO_GENERATE_WEEKS_AHEAD = 8;

function autoGenerateThroughDate(): string {
  const { dateIso } = getMountainTimeNow();
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + AUTO_GENERATE_WEEKS_AHEAD * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Lazy sweep, same pattern as autoArchivePastMeetings/
 * sweepMeetingCancellations -- run on every /dashboard and
 * /calling-planning load (via getUpcomingMeetings) so whatever's
 * configured in /meeting-schedule's own cadence rules (Sacrament
 * Meeting, Bishopric Meeting, Ward Council, Youth Council, or any
 * other active rule) just keeps existing roughly 8 weeks out, with
 * nobody ever needing to visit /meeting-schedule and click "Generate
 * Meetings" themselves. The user's own request, 2026-10-16: "What if I
 * didn't want to ever have to generate typical activity or meeting
 * dates... It would be ok to be able to set the cadence/rules
 * somewhere but I don't want to have to generate these events."
 *
 * Reuses `generateMeetingsFromRules` exactly as the manual button
 * does -- idempotent (skips any date that already has a meeting for
 * that type), so repeated calls on every page view are safe and cheap
 * once the horizon is already covered. The actual cadence (which
 * Sundays get which meeting types) is entirely driven by whatever's
 * configured in `meeting_schedule_rules` via /meeting-schedule's own
 * existing UI -- this function doesn't know or assume anything about
 * the rules themselves, only that it should keep applying them without
 * being asked. A real schedule change (Stake/General Conference,
 * etc.) still needs the existing `meeting_cancellations`/manual-edit
 * tools, same as before; this only automates the routine, week-to-week
 * case.
 *
 * Errors are swallowed, not surfaced -- a background sweep failing
 * (e.g. a transient DB hiccup) should never block Dashboard/Calling
 * Planning from rendering. The manual "Generate Meetings" button on
 * /meeting-schedule still exists too, for generating further ahead
 * than the rolling window or retrying directly after a rules change.
 */
export async function autoGenerateUpcomingMeetings(): Promise<void> {
  try {
    await generateMeetingsFromRules(autoGenerateThroughDate());
  } catch {
    // Swallow -- see this function's own doc comment.
  }
}
