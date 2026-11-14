import { createClient } from "@supabase/supabase-js";

/**
 * A plain anon-key Supabase client with no cookie/session plumbing --
 * for use strictly inside `unstable_cache`-wrapped functions, which
 * Next.js forbids from calling anything that reads `cookies()`/
 * `headers()` (what `lib/supabase/server.ts`'s cookie-aware
 * `createClient()` does under the hood). Mirrors
 * `lib/supabase/service-role.ts`'s exact shape, just with the public
 * anon key instead of the service-role key -- correct here because
 * every table this is used against (`hymnal_songs`, `ward_settings`)
 * already has its own anon-facing RLS policy allowing the exact read
 * being cached, so there's no need to bypass RLS the way the
 * service-role client does for the cron sweep.
 *
 * Added 2026-11-14, part of a pre-launch performance pass -- see
 * PROJECT_CONTEXT.md's own dated entry for the full reasoning.
 */
export function createCacheableClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
