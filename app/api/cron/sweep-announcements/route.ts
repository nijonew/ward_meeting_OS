import { NextResponse } from "next/server";
import { sweepPastAnnouncements } from "@/lib/data/announcements";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron hits this once a day (see `vercel.json`) -- a real,
 * out-of-band background sweep, 2026-11-08 (the user's own request:
 * "add a mechanism that sweeps announcements on a set interval. I
 * don't want to slow things down"). This never runs as part of, or
 * adds any latency to, a normal page request -- it's a completely
 * separate scheduled invocation on Vercel's own clock, independent of
 * whether anyone actually opens a page that happens to trigger
 * `sweepPastAnnouncements` on its own (which is still the only way
 * this ever ran before today -- several real announcements in
 * production had simply gone un-visited by anything that sweeps,
 * since their own date passed, exactly the user's own report: "other
 * announcements that were still showing up past their scheduled dates
 * had not been set to archive").
 *
 * Daily, not more often -- an announcement almost always lapses by
 * *date*, not by the exact hour; the existing lazy sweeps already
 * triggered from real page loads (the public page, Manage
 * Announcements, Table Admin, a Sacrament Meeting's own Planning page)
 * still catch same-day time-of-day lapsing promptly on their own. This
 * is a backstop that guarantees nothing sits stale for more than a day
 * even if none of those pages happens to be visited at all.
 *
 * Authenticated via Vercel's own documented convention: a Cron Job's
 * request carries `Authorization: Bearer <CRON_SECRET>` automatically
 * whenever that env var is set on the project, so a stray or forged
 * request to this path can't trigger it. **`CRON_SECRET` needs to be
 * added as a new Vercel environment variable** (any random string --
 * this assistant has no Vercel access to add it) before this can run
 * at all; without it, every request (including Vercel's own) is
 * rejected rather than silently running unauthenticated.
 *
 * Runs with the service-role client, not the usual cookie-based anon
 * one -- a Cron invocation has no session/cookies at all, so it would
 * otherwise run as a plain anonymous request; see
 * `lib/supabase/service-role.ts`'s own comment for why that matters
 * specifically for this table. **`SUPABASE_SERVICE_ROLE_KEY` also
 * needs to be added as a new Vercel environment variable** (the
 * `service_role` key from Supabase's own dashboard -> Project Settings
 * -> API -- not the anon key this app uses everywhere else) before
 * this route can do anything either.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await sweepPastAnnouncements(createServiceRoleClient());
  return NextResponse.json({ ok: true });
}
