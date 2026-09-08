"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCalling(formData: FormData) {
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
