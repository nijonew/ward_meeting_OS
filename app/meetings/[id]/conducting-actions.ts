"use server";

import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getConductingRows } from "@/lib/data/conducting";
import type { ConductingRow } from "@/lib/data/conducting-rows";

/**
 * Polled by ConductingScriptView (2026-09-10, the user's own request:
 * "read-only, but updates in real time as the planning view updates")
 * every few seconds while the Conducting page is open, so an edit made
 * on Planning shows up here without a manual reload. Re-checks the
 * same Bishopric-only gate the page itself enforces -- matching the
 * pattern used by every other role-gated action in this app -- rather
 * than trusting that only an authorized session would be polling in
 * the first place.
 */
export async function refreshConductingScript(meetingId: string): Promise<ConductingRow[] | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "sacrament_conducting")) return null;

  const script = await getConductingRows(meetingId);
  return script?.rows ?? null;
}
