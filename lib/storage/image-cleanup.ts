import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const STORAGE_PUBLIC_URL_MARKER = "/storage/v1/object/public/";

/**
 * Best-effort delete of a Supabase Storage object, given nothing but
 * its own public URL -- the bucket and path are already encoded in
 * that URL (`.../storage/v1/object/public/<bucket>/<path>`), so no
 * column needs to separately declare which bucket it lives in. Shared
 * by every "image"-type column across this app (migration 098's
 * feedback screenshots, migration 099's announcement images, and any
 * future one) -- both the generic Table Admin row-delete cleanup
 * (`deleteAdminRow`) and announcements' own archive-time cleanup
 * (`sweepPastAnnouncements`) call this directly.
 *
 * Swallows any error (a malformed URL, an object that's already gone,
 * a permissions gap) -- losing the real database write over a storage
 * cleanup that didn't happen would be a worse failure than a harmless
 * orphaned file sitting in Storage.
 */
export async function deleteStorageImageAtUrl(
  supabase: SupabaseServerClient,
  url: string | null | undefined
): Promise<void> {
  if (!url) return;
  const marker = url.indexOf(STORAGE_PUBLIC_URL_MARKER);
  if (marker === -1) return;

  const rest = url.slice(marker + STORAGE_PUBLIC_URL_MARKER.length);
  const slash = rest.indexOf("/");
  if (slash === -1) return;

  const bucket = rest.slice(0, slash);
  const path = decodeURIComponent(rest.slice(slash + 1));

  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // best-effort -- see doc comment above
  }
}
