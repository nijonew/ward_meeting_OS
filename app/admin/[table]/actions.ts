"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getAdminTableConfig } from "@/lib/admin/registry";
import { insertAdminRow, updateAdminRow, deleteAdminRow } from "@/lib/admin/table-data";

type ActionResult = { success: true } | { error: string };

/**
 * Every generic admin action re-checks the role server-side rather than
 * trusting the page that rendered the button -- this file is the actual
 * enforcement boundary, not app/admin/[table]/page.tsx.
 */
async function requireBishopric(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (profile?.role !== "bishopric") return { error: "Not authorized." };
  return null;
}

export async function updateRow(
  table: string,
  id: string,
  patch: Record<string, unknown>
): Promise<ActionResult> {
  const denied = await requireBishopric();
  if (denied) return denied;

  const config = getAdminTableConfig(table);
  if (!config) return { error: "Unknown table." };

  const result = await updateAdminRow(config, id, patch);
  if ("success" in result) revalidatePath(`/admin/${table}`);
  return result;
}

export async function insertRow(table: string, patch: Record<string, unknown>): Promise<ActionResult> {
  const denied = await requireBishopric();
  if (denied) return denied;

  const config = getAdminTableConfig(table);
  if (!config) return { error: "Unknown table." };

  const result = await insertAdminRow(config, patch);
  if ("success" in result) revalidatePath(`/admin/${table}`);
  return result;
}

export async function deleteRow(table: string, id: string): Promise<ActionResult> {
  const denied = await requireBishopric();
  if (denied) return denied;

  const config = getAdminTableConfig(table);
  if (!config) return { error: "Unknown table." };

  const result = await deleteAdminRow(config, id);
  if ("success" in result) revalidatePath(`/admin/${table}`);
  return result;
}
