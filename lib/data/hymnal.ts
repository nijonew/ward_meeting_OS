import { unstable_cache } from "next/cache";
import { createCacheableClient } from "@/lib/supabase/cacheable-client";
import { resolveHymnTitle, type HymnalIndexEntry } from "@/lib/data/hymnal-shared";

export * from "@/lib/data/hymnal-shared";

/**
 * The full Music Reference table (all three collections), fetched once
 * and handed down to the planning page's client components so a hymn
 * number resolves to its title instantly as it's typed, with no
 * per-keystroke round trip -- Music Reference is small enough (a few
 * hundred rows total) that shipping the whole thing is simpler and
 * faster than a server action per keystroke. See
 * lib/data/hymnal-shared.ts's resolveHymnTitle for how a raw input
 * string (e.g. "223", "C20") is matched against it.
 *
 * **Wrapped in `unstable_cache`, 2026-11-14 pre-launch performance
 * pass.** This table is read-only from the app's own perspective (it's
 * admin-maintained reference data, not something a meeting's own
 * planning writes to) and this is the single highest-traffic query in
 * the app -- every Sunday's public program load, plus every admin
 * Planning page, all fetch the same ~700 rows fresh every time. A
 * 5-minute cross-request cache means at most one real query per 5
 * minutes app-wide, not one per page view. `unstable_cache` can't call
 * anything that reads `cookies()`/`headers()`, so this uses a plain
 * anon-key client (`createCacheableClient`) instead of the app's usual
 * cookie-aware one -- safe here since `hymnal_songs` already has its
 * own anon-facing RLS policy covering exactly this read.
 */
const fetchHymnalIndex = unstable_cache(
  async (): Promise<HymnalIndexEntry[]> => {
    const supabase = createCacheableClient();
    const { data } = await supabase.from("hymnal_songs").select("songbook, number, title, url");
    return (data ?? []) as HymnalIndexEntry[];
  },
  ["hymnal-index"],
  { revalidate: 300 },
);

export async function getHymnalIndex(): Promise<HymnalIndexEntry[]> {
  return fetchHymnalIndex();
}

/**
 * Looks up hymn titles from Music Reference for a batch of raw
 * hymn-number field values -- the server-side save-time fallback used
 * by every write path that accepts a bare hymn number (bulk paste and
 * the single-item form at /music, the agenda grid's music rows,
 * Intermediate Hymn in the Speakers & Music list). Built 2026-09-10
 * after the user reported hymn numbers being entered with no title
 * alongside them; generalized 2026-10-03 to resolve against all three
 * Music Reference collections (previously 1985 Hymnal only) once the
 * "C" prefix convention existed to disambiguate the Children's
 * Songbook from it.
 *
 * Returns a Map keyed by the exact raw input string, missing an entry
 * for any input with no match (a genuine gap in Music Reference, a
 * typo, or an unparseable input) -- callers should leave the title
 * blank in that case rather than block the save over it.
 */
export async function lookupHymnTitles(rawInputs: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(rawInputs.map((r) => r.trim()).filter(Boolean)));
  if (unique.length === 0) return new Map();

  const index = await getHymnalIndex();
  const map = new Map<string, string>();
  for (const raw of unique) {
    const title = resolveHymnTitle(raw, index);
    if (title) map.set(raw, title);
  }
  return map;
}

/** Single-input convenience wrapper around lookupHymnTitles, for the
 *  write paths that only ever handle one hymn at a time. */
export async function lookupHymnTitle(rawInput: string): Promise<string | null> {
  const map = await lookupHymnTitles([rawInput]);
  return map.get(rawInput.trim()) ?? null;
}
