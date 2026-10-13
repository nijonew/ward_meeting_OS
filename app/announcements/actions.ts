"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getAdminTableConfig } from "@/lib/admin/registry";
import { updateAdminRow, insertAdminRow, deleteAdminRow } from "@/lib/admin/table-data";

type ActionResult = { success: true } | { error: string };

/**
 * Real management for /announcements, 2026-10-12 (the user's own
 * report: "Manage announcements... looks like no real management can
 * happen here and that it is essentially a viewing location again...
 * [the Table Admin] announcements table... is basically what I want
 * manage announcements to be"). These three reuse the exact same
 * AdminTableEditor component and `announcements` registry column
 * config Table Admin's own /admin/announcements uses -- but gated on
 * `announcement_management`, not `table_admin_announcements`, since
 * this page has always been reached by a different, narrower feature
 * than raw Table Admin access. Calling the shared
 * updateAdminRow/insertAdminRow/deleteAdminRow helpers directly (rather
 * than app/admin/[table]/actions.ts's own wrappers, which check
 * `table_admin_announcements` instead) keeps the two entry points'
 * authorization independent while sharing every bit of the actual
 * read/write logic.
 */
async function requireAnnouncementManagement(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "announcement_management")) return { error: "Not authorized." };
  return null;
}

export async function updateAnnouncementRow(
  table: string,
  id: string,
  patch: Record<string, unknown>
): Promise<ActionResult> {
  const denied = await requireAnnouncementManagement();
  if (denied) return denied;
  const config = getAdminTableConfig("announcements");
  if (!config) return { error: "Unknown table." };
  const result = await updateAdminRow(config, id, patch);
  if ("success" in result) revalidatePath("/announcements");
  return result;
}

export async function insertAnnouncementRow(table: string, patch: Record<string, unknown>): Promise<ActionResult> {
  const denied = await requireAnnouncementManagement();
  if (denied) return denied;
  const config = getAdminTableConfig("announcements");
  if (!config) return { error: "Unknown table." };
  const result = await insertAdminRow(config, patch);
  if ("success" in result) revalidatePath("/announcements");
  return result;
}

export async function deleteAnnouncementRow(table: string, id: string): Promise<ActionResult> {
  const denied = await requireAnnouncementManagement();
  if (denied) return denied;
  const config = getAdminTableConfig("announcements");
  if (!config) return { error: "Unknown table." };
  const result = await deleteAdminRow(config, id);
  if ("success" in result) revalidatePath("/announcements");
  return result;
}

// Had no server-side check at all before this (2026-10-04, found while
// converting the page's own gate to the granular-features model) --
// only the page's own gate kept this inbox's controls out of a
// non-admin's view.
export async function setSubmissionStatus(
  kind: "announcement" | "agenda_item",
  id: string,
  status: "published" | "archived"
): Promise<ActionResult> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "announcement_management")) return { error: "Not authorized." };

  const supabase = await createClient();
  const table = kind === "announcement" ? "announcements" : "agenda_items";

  const { error } = await supabase.from(table).update({ status }).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/announcements");
  return { success: true };
}
