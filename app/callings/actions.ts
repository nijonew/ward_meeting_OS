"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

// Had no server-side check at all before this (2026-10-04, found while
// converting the page's own gate to the granular-features model) --
// only the page's own gate kept the "Add Calling" form out of a
// non-admin's view.
export async function createCalling(formData: FormData) {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "callings_roster")) {
    redirect(`/callings?error=${encodeURIComponent("Not authorized.")}`);
  }

  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const titlePrefix = String(formData.get("title_prefix") ?? "").trim() || null;

  if (!name) {
    redirect(`/callings?error=${encodeURIComponent("Name is required.")}`);
  }

  const { error } = await supabase.from("callings").insert({ name, title_prefix: titlePrefix });

  if (error) {
    redirect(`/callings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/callings");
  redirect("/callings");
}
