"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { error?: string; success?: boolean };

/**
 * Parses the grid's "<date>::<sourceGroupName>::<column>" field names
 * back apart, same encoding convention used throughout this app's other
 * grids (e.g. the main agenda grid's "role::<key>"). A line with a
 * blank Title is skipped entirely -- "fill in the rest" only applies to
 * lines someone actually filled in; it never creates (or blanks out) a
 * row just because the grid rendered an empty line for an unplanned
 * week.
 *
 * Writes to the exact (activity_date, group_name) pair the line was
 * drawn from -- editing a Combined-sourced line updates that one real,
 * shared row (visible to every other class that attends it too), not a
 * class-specific fork of it. A genuinely blank line has no existing row
 * to update, so it's always created as this class's own individual
 * activity -- there's no way to decide "this should actually be a
 * Combined week" from a single class's own page.
 */
export async function saveClassActivityGrid(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "youth_activity_planning")) return { error: "Not authorized." };

  type Fields = {
    title: string;
    location: string;
    development_category: string;
    planning_group: string;
    confirmed: string;
  };
  const byKey = new Map<string, Fields>();
  const COLUMNS = ["title", "location", "development_category", "planning_group", "confirmed"];

  // Confirmed's hidden "false" fallback is enumerated before its real
  // checkbox in the form (so an unchecked box still submits something,
  // same trick this app already uses for Stake Business) -- this loop
  // overwrites per column as it walks entries in document order, so
  // the checkbox's own "true" naturally wins when it's checked.
  for (const [name, value] of formData.entries()) {
    const parts = name.split("::");
    if (parts.length !== 3) continue;
    const [activityDate, sourceGroupName, column] = parts;
    if (!COLUMNS.includes(column)) continue;

    const key = `${activityDate}::${sourceGroupName}`;
    const fields = byKey.get(key) ?? { title: "", location: "", development_category: "", planning_group: "", confirmed: "false" };
    fields[column as keyof Fields] = String(value).trim();
    byKey.set(key, fields);
  }

  const entries = Array.from(byKey.entries()).filter(([, fields]) => fields.title.length > 0);
  if (entries.length === 0) return { success: true };

  const supabase = await createClient();

  const dates = Array.from(new Set(entries.map(([key]) => key.split("::")[0])));
  const groupNames = Array.from(new Set(entries.map(([key]) => key.split("::")[1])));

  const { data: existingRows, error: fetchError } = await supabase
    .from("youth_activities")
    .select("id, activity_date, group_name")
    .in("activity_date", dates)
    .in("group_name", groupNames);

  if (fetchError) return { error: fetchError.message };

  const existingByKey = new Map(
    ((existingRows ?? []) as { id: string; activity_date: string; group_name: string }[]).map((r) => [
      `${r.activity_date}::${r.group_name}`,
      r.id,
    ])
  );

  const results = await Promise.all(
    entries.map(([key, fields]) => {
      const [activityDate, sourceGroupName] = key.split("::");
      const existingId = existingByKey.get(key);

      const confirmed = fields.confirmed === "true";

      if (existingId) {
        return supabase
          .from("youth_activities")
          .update({
            title: fields.title,
            location: fields.location || null,
            development_category: fields.development_category || null,
            planning_group: fields.planning_group || null,
            confirmed,
          })
          .eq("id", existingId);
      }

      return supabase.from("youth_activities").insert({
        activity_date: activityDate,
        activity_time: "19:00",
        title: fields.title,
        group_name: sourceGroupName,
        location: fields.location || null,
        development_category: fields.development_category || null,
        planning_group: fields.planning_group || null,
        confirmed,
        status: "published",
      });
    })
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath("/youth-activities/manage/classes");
  revalidatePath("/youth-activities/upcoming");
  revalidatePath("/youth-activities/combined-ym");
  revalidatePath("/youth-activities/combined-ym-yw");
  revalidatePath("/youth-activities/combined-yw");
  revalidatePath("/events");
  return { success: true };
}

/**
 * Delete a class's own individual activity row, 2026-10-16 (the
 * user's own report: "I am not seeing where I have the ability to
 * delete a youth activity whether it is combined or not"). Deliberately
 * only for a row this class actually owns (`ClassActivityGridForm`
 * only ever renders the button when `!row.isCombined`, and this action
 * re-checks that server-side too) -- a row drawn live from a shared
 * Combined row (`row.isCombined`) isn't this class's own to delete;
 * removing it here would delete the one real row every other
 * attending class also sees, from a page that only shows one class at
 * a time. Deleting a genuinely Combined row belongs on its own
 * Combined-group page instead (see `deleteYouthActivity`,
 * `app/youth-activities/actions.ts`).
 */
export async function deleteClassActivity(activityId: string): Promise<ActionResult> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "youth_activity_planning")) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: row, error: fetchError } = await supabase
    .from("youth_activities")
    .select("group_name")
    .eq("id", activityId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!row) return { success: true };
  if (row.group_name.startsWith("Combined")) {
    return { error: "This is a Combined activity -- delete it from its own Combined page instead." };
  }

  const { error } = await supabase.from("youth_activities").delete().eq("id", activityId);
  if (error) return { error: error.message };

  revalidatePath("/youth-activities/manage/classes");
  revalidatePath("/youth-activities/upcoming");
  revalidatePath("/events");
  return { success: true };
}
