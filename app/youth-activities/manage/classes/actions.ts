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

  type Fields = { title: string; location: string; development_category: string; planning_group: string };
  const byKey = new Map<string, Fields>();

  for (const [name, value] of formData.entries()) {
    const parts = name.split("::");
    if (parts.length !== 3) continue;
    const [activityDate, sourceGroupName, column] = parts;
    if (!["title", "location", "development_category", "planning_group"].includes(column)) continue;

    const key = `${activityDate}::${sourceGroupName}`;
    const fields = byKey.get(key) ?? { title: "", location: "", development_category: "", planning_group: "" };
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

      if (existingId) {
        return supabase
          .from("youth_activities")
          .update({
            title: fields.title,
            location: fields.location || null,
            development_category: fields.development_category || null,
            planning_group: fields.planning_group || null,
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
