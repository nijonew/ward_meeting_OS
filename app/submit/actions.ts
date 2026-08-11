"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function submitItem(formData: FormData) {
  const supabase = await createClient();

  const kind = String(formData.get("kind") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const name = String(formData.get("submitted_by_name") ?? "").trim();
  const email = String(formData.get("submitted_by_email") ?? "").trim();

  if (!title || !name || !email) {
    redirect(`/submit?error=${encodeURIComponent("Name, email, and title are required.")}`);
  }

  const table = kind === "announcement" ? "announcements" : "agenda_items";

  const { error } = await supabase.from(table).insert({
    title,
    body,
    submitted_by_name: name,
    submitted_by_email: email,
    status: "pending",
  });

  if (error) {
    redirect(`/submit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/announcements");
  redirect("/submit?success=1");
}
