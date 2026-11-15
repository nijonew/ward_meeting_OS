import { createClient } from "@supabase/supabase-js";

/**
 * A plain anon-key Supabase client with no cookie/session plumbing --
 * for use strictly inside `unstable_cache`-wrapped functions, which
 * Next.js forbids from calling anything that reads `cookies()`/
 * `headers()` (what `lib/supabase/server.ts`'s cookie-aware
 * `createClient()` does under the hood). Mirrors
 * `lib/supabase/service-role.ts`'s exact shape, just with the public
 * anon key instead of the service-role key -- correct ONLY because
 * every table this is actually used against has its own matching
 * `anon` SELECT policy, so there's no need to bypass RLS the way the
 * service-role client does for the cron sweep.
 *
 * **This is a real, easy-to-miss trap, not a formality -- it already
 * bit two tables in production.** With no session attached at all,
 * every query through this client runs as Postgres's `anon` role
 * regardless of which API key constructed it -- a table whose RLS
 * only has a `to authenticated` policy (no `anon` one) silently
 * returns zero rows, no error, which looks exactly like "the table is
 * empty." `features` and `admin_select_options` were added as
 * callers (`getFeatureCatalogByCategory`/`getSelectOptions`) without
 * checking this first -- found 2026-11-15 when `/admin/calling-features`
 * stopped showing any features at all for anyone, fixed by migration
 * `108` adding the missing `anon` policy to both (the same low-
 * sensitivity-catalog-data reasoning already used for `hymnal_songs`/
 * `ward_settings` below). **Before adding a new caller here, confirm
 * the target table already has an `anon` SELECT policy -- adding one
 * is a real, deliberate RLS change, not something to assume.**
 *
 * Added 2026-11-14, part of a pre-launch performance pass -- see
 * PROJECT_CONTEXT.md's own dated entry for the full reasoning. Current
 * callers: `hymnal_songs`/`ward_settings` (anon policies from the
 * start), `features`/`admin_select_options` (anon policies added by
 * migration `108`), and `public-view.ts`'s cached Sacrament Meeting
 * read (several tables, each already covered by its own narrow anon
 * policy from migration `075` and earlier).
 */
export function createCacheableClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
