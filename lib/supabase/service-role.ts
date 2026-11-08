import { createClient } from "@supabase/supabase-js";

/**
 * A service-role Supabase client -- bypasses RLS entirely, unlike
 * every other client in this app (`lib/supabase/server.ts`/`client.ts`
 * both always use the anon key, per architecture.md's own "RLS
 * enforced on every table... app uses the anon key everywhere, not
 * service role" rule). This is the one deliberate exception, added
 * 2026-11-08 for exactly one route: a Vercel-Cron-triggered sweep has
 * no user session or cookies at all, so it would otherwise run as a
 * plain anonymous request -- exactly the class of silent RLS failure
 * this project has been bitten by repeatedly (see PROJECT_CONTEXT.md's
 * own long list of undocumented-RLS-policy incidents, none of which
 * were ever written down in a tracked migration for `announcements`
 * itself). Using the service role here guarantees the sweep's own
 * archive write can never be silently blocked by whatever anon policy
 * does or doesn't exist on that table.
 *
 * Server-only -- `SUPABASE_SERVICE_ROLE_KEY` is never prefixed
 * `NEXT_PUBLIC_`, so it can't end up bundled into client code. Never
 * import this from anything a browser could reach; it's wired into
 * exactly one route today (`app/api/cron/sweep-announcements`), which
 * itself requires a secret bearer token before it does anything.
 */
export function createServiceRoleClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
