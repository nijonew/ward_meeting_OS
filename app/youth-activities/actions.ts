"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateCombinedYouthActivities } from "@/lib/data/youth-activity-schedule";
import { classesForCombinedGroup } from "@/lib/data/class-activities-shared";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

export type ActionResult = { success: true } | { error: string };

/** Every page that actually lists activities -- revalidated together
 *  since both actions below can add a row of any group. Moved here
 *  (2026-10-11) once Add Activity/Generate relocated to their own
 *  Manage page, which shows none of this data itself. */
function revalidateActivityListings() {
  revalidatePath("/youth-activities/upcoming");
  revalidatePath("/youth-activities/combined-ym");
  revalidatePath("/youth-activities/combined-ym-yw");
  revalidatePath("/youth-activities/combined-yw");
  revalidatePath("/events");
}

// None of these had a server-side check at all before this (2026-10-04,
// found while converting the page's own gate to the granular-features
// model) -- only the page's own gate kept the controls out of a
// non-admin's view.
async function requireYouthActivityPlanningFeature(): Promise<{ error: string } | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "youth_activity_planning")) return { error: "Not authorized." };
  return null;
}

export async function addYouthActivity(formData: FormData): Promise<ActionResult> {
  const denied = await requireYouthActivityPlanningFeature();
  if (denied) return denied;

  const supabase = await createClient();

  const activity_date = formData.get("activity_date") as string;
  const activity_time = (formData.get("activity_time") as string) || null;
  const title = formData.get("title") as string;
  const group_name = formData.get("group_name") as string;
  const location = (formData.get("location") as string) || null;
  const development_category = (formData.get("development_category") as string) || null;
  const planning_group = (formData.get("planning_group") as string) || null;
  const youth_lead = (formData.get("youth_lead") as string) || null;
  const advisor_lead = (formData.get("advisor_lead") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!activity_date || !title || !group_name) {
    return { error: "Date, title, and group are required." };
  }

  const { error } = await supabase.from("youth_activities").insert({
    activity_date,
    activity_time,
    title,
    group_name,
    location,
    development_category,
    planning_group,
    youth_lead,
    advisor_lead,
    notes,
    status: "published",
  });

  if (error) {
    return { error: error.message };
  }

  revalidateActivityListings();
  return { success: true };
}

export async function generateYouthActivities(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; created?: number; skippedExisting?: number }> {
  const denied = await requireYouthActivityPlanningFeature();
  if (denied) return denied;

  const throughDate = String(formData.get("through_date") ?? "");
  if (!throughDate) return { error: "Choose an end date." };

  const result = await generateCombinedYouthActivities(throughDate);
  if ("error" in result) return { error: result.error };

  revalidateActivityListings();
  return { created: result.created, skippedExisting: result.skippedExisting };
}

/**
 * "I also want to have a button to command that the combined activity
 * overwrite the activity on the same date of the appropriate groups
 * (all YM/YW for combined YM/YW, only the YW for combined YW, only the
 * YM for combined YM)" -- the user's own request, 2026-10-11. Copies a
 * Combined activity's content (title/time/location/category/leads/
 * notes) onto each attending class's own individual row for that same
 * date -- creating it if none exists yet, overwriting it if one does.
 * Deliberately does NOT copy `planning_group` (a combined-only concept
 * -- an individual class's own activity has no one else to name as
 * responsible) or the confirmed/cancelled lifecycle flags (left as
 * whatever they already were, or their defaults for a newly-created
 * row, so a class's own planning state stays independently
 * manageable after the copy).
 *
 * This is a one-time "stamp a copy out to each class" action, distinct
 * from getClassActivityGrid's own live fallback display (a class with
 * no individual row yet already shows the Combined row's content
 * there automatically) -- after this runs, each target class has a
 * real row of its own, so further edits from its own page only affect
 * that one class, not the shared Combined row or any other class's
 * copy.
 */
export async function pushCombinedActivityToClasses(activityId: string): Promise<ActionResult> {
  const denied = await requireYouthActivityPlanningFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: source, error: fetchError } = await supabase
    .from("youth_activities")
    .select("activity_date, activity_time, title, location, development_category, youth_lead, advisor_lead, notes, group_name")
    .eq("id", activityId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!source) return { error: "Could not find that activity." };

  const targets = classesForCombinedGroup(source.group_name as string);
  if (!targets) return { error: "Not a Combined activity." };

  const { data: existingRows, error: existingError } = await supabase
    .from("youth_activities")
    .select("id, group_name")
    .eq("activity_date", source.activity_date)
    .in("group_name", targets);

  if (existingError) return { error: existingError.message };

  const existingIdByGroup = new Map(
    ((existingRows ?? []) as { id: string; group_name: string }[]).map((r) => [r.group_name, r.id])
  );

  const copiedFields = {
    activity_time: source.activity_time,
    title: source.title,
    location: source.location,
    development_category: source.development_category,
    youth_lead: source.youth_lead,
    advisor_lead: source.advisor_lead,
    notes: source.notes,
  };

  const results = await Promise.all(
    targets.map((groupName) => {
      const existingId = existingIdByGroup.get(groupName);
      if (existingId) {
        return supabase.from("youth_activities").update(copiedFields).eq("id", existingId);
      }
      return supabase.from("youth_activities").insert({
        activity_date: source.activity_date,
        group_name: groupName,
        status: "published",
        ...copiedFields,
      });
    })
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath("/youth-activities/manage/classes");
  return { success: true };
}

/**
 * Inline edit for the Combined-group pages' own grid (2026-10-11, the
 * user's own request: "I want to be able to modify combined
 * activities. I also want to see which group is in charge of the
 * activity") -- the second half of that request (seeing `planning_group`)
 * is a plain new column on `ActivitiesTable` itself, no action needed;
 * this is the "modify" half. Field names are "<id>::<column>", same
 * convention as every other grid's own save action, but simpler than
 * `saveClassActivityGrid`'s (date, group_name) keying -- every row
 * rendered on a Combined-group page is already a real `youth_activities`
 * row with a real id (unlike the per-class grid, which can render a
 * synthetic/fallback line for an unplanned week), so there's no lookup
 * step needed before updating.
 */
export async function saveActivityGrid(
  _prevState: { error?: string; success?: boolean },
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const denied = await requireYouthActivityPlanningFeature();
  if (denied) return denied;

  const supabase = await createClient();

  type Fields = { activity_time: string; title: string; planning_group: string; notes: string };
  const COLUMNS = ["activity_time", "title", "planning_group", "notes"];
  const byId = new Map<string, Fields>();

  for (const [name, value] of formData.entries()) {
    const parts = name.split("::");
    if (parts.length !== 2) continue;
    const [id, column] = parts;
    if (!COLUMNS.includes(column)) continue;
    const fields = byId.get(id) ?? { activity_time: "", title: "", planning_group: "", notes: "" };
    fields[column as keyof Fields] = String(value).trim();
    byId.set(id, fields);
  }

  if (byId.size === 0) return { success: true };

  for (const [, fields] of byId.entries()) {
    if (!fields.title) return { error: "Title cannot be blank." };
  }

  const results = await Promise.all(
    Array.from(byId.entries()).map(([id, fields]) =>
      supabase
        .from("youth_activities")
        .update({
          activity_time: fields.activity_time || null,
          title: fields.title,
          planning_group: fields.planning_group || null,
          notes: fields.notes || null,
        })
        .eq("id", id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidateActivityListings();
  return { success: true };
}