"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/get-session-user";

type FeedbackState = { error?: string; success?: boolean };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Requires a signed-in user, same as submitAnnouncement/submitAgendaItem --
 *  the widget itself only ever mounts on a logged-in page (see app/layout.tsx),
 *  but this re-checks server-side anyway, matching this app's own
 *  defense-in-depth convention. No self-reported name/email field --
 *  attributed from the session, same reasoning as those two actions.
 *
 * **Optional screenshot, migration 098, 2026-11-01** -- two different
 * people independently asked for this the same day the widget was
 * first built. Uploads to the new `feedback-images` Storage bucket
 * (public, no signed URLs needed -- see that migration's own comment
 * for why) under a random filename, never the browser's own, so two
 * people's unrelated "screenshot.png" can never collide. An upload
 * failure here fails the whole submission rather than silently
 * dropping the image, since the submitter explicitly chose to attach
 * it as part of their report. */
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

  let imageUrl: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (!image.type.startsWith("image/")) {
      return { error: "The attachment must be an image." };
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return { error: "Image must be smaller than 5MB." };
    }
    const ext = image.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("feedback-images")
      .upload(path, image, { contentType: image.type });
    if (uploadError) return { error: `Could not upload image: ${uploadError.message}` };
    imageUrl = supabase.storage.from("feedback-images").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("feedback").insert({
    type,
    body,
    page_path: pagePath,
    image_url: imageUrl,
    submitted_by_name: profile?.display_name || user.email || "(not given)",
    submitted_by_email: profile?.email || user.email || "",
    status: "new",
  });

  if (error) return { error: error.message };
  return { success: true };
}
