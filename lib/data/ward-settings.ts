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

/**
 * The order Ward Business's three subsections (Releases, Callings, and
 * the RABNM-planning pool) render in on a Sacrament Meeting's Planning
 * page -- migration 091, the user's own request: "I would like to be
 * able to adjust the order of subsections in the ward business
 * section." A single ward-wide preference, same singleton-row shape as
 * the ward's own display name, not a per-meeting setting -- there's no
 * real reason one meeting would want a different subsection order than
 * another.
 */
export const WARD_BUSINESS_SECTION_KEYS = ["release", "new_calling", "rabnm"] as const;
export type WardBusinessSectionKey = (typeof WARD_BUSINESS_SECTION_KEYS)[number];

/** Keeps only recognized keys, in their stored order, then appends any
 *  missing key at the end -- so a key this app doesn't know about
 *  (stale data, or a future one not yet added here) never gets lost
 *  silently, and a brand-new key added to the fixed list above always
 *  has somewhere to render even before anyone's ever reordered it. */
export function normalizeWardBusinessSectionOrder(
  stored: string[] | null | undefined
): WardBusinessSectionKey[] {
  const valid = new Set<string>(WARD_BUSINESS_SECTION_KEYS);
  const kept = (stored ?? []).filter((k): k is WardBusinessSectionKey => valid.has(k));
  const missing = WARD_BUSINESS_SECTION_KEYS.filter((k) => !kept.includes(k));
  return [...kept, ...missing];
}

export const getWardBusinessSectionOrder = cache(async (): Promise<WardBusinessSectionKey[]> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("ward_settings").select("ward_business_section_order").limit(1).maybeSingle();
    return normalizeWardBusinessSectionOrder(data?.ward_business_section_order as string[] | null | undefined);
  } catch {
    return [...WARD_BUSINESS_SECTION_KEYS];
  }
});
