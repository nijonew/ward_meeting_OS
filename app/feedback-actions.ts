"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/get-session-user";

type FeedbackState = { error?: string; success?: boolean };

/** Requires a signed-in user, same as submitAnnouncement/submitAgendaItem --
 *  the widget itself only ever mounts on a logged-in page (see app/layout.tsx),
 *  but this re-checks server-side anyway, matching this app's own
 *  defense-in-depth convention. No self-reported name/email field --
 *  attributed from the session, same reasoning as those two actions. */
export async function submitFeedback(_prevState: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const { user, profile } = await getSessionUser();
  if (!user) return { error: "You must be signed in to submit feedback." };

  const type = String(formData.get("type") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const pagePath = String(formData.get("page_path") ?? "").trim() || null;

  if (type !== "bug" && type !== "suggestion") {
    return { error: "Choose Bug/Fix or Suggestion/Upgrade." };
  }
  if (!body) {
    return { error: "Describe the fix or upgrade you're suggesting." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({
    type,
    body,
    page_path: pagePath,
    submitted_by_name: profile?.display_name || user.email || "(not given)",
    submitted_by_email: profile?.email || user.email || "",
    status: "new",
  });

  if (error) return { error: error.message };
  return { success: true };
}
