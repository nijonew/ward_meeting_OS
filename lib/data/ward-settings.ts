import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The ward's own display name, shown as "<name> Ward" in the header
 * wordmark and the home/login pages (2026-10-03, the user's own
 * request -- see ward_settings' own migration comment for the full
 * context). Reads the one row in `ward_settings`, admin-editable via
 * Table Admin -- replaces the old env-var-only `WARD_NAME`
 * (lib/config.tsx, now removed) that nobody could change without a
 * code deploy.
 *
 * Falls back to "Ward" on any error or a genuinely missing row --
 * this renders on every single page, including fully public ones with
 * no session at all, so it must never be the reason a page fails to
 * render.
 *
 * Wrapped in React's `cache()` (2026-10-07, same fix as
 * getSessionUser/getMeetingById) -- `AppHeader` calls this on nearly
 * every page already, and several pages (the landing page, `/login`)
 * also call it directly for their own heading, duplicating the same
 * query within one request.
 */
export const getWardName = cache(async (): Promise<string> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("ward_settings").select("ward_name").limit(1).maybeSingle();
    return data?.ward_name?.trim() || "Ward";
  } catch {
    return "Ward";
  }
});
