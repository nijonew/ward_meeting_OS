import { createClient } from "@/lib/supabase/server";

/**
 * Looks up hymn titles from Music Reference (hymnal_songs), 1985 Hymnal
 * specifically -- the hymnal every congregational hymn type this app
 * tracks (Opening/Sacrament/Closing/Intermediate Hymn) is actually sung
 * from. Musical Number never carries a hymn_number in any of this
 * app's forms, so it's never affected by this.
 *
 * Built 2026-09-10 after the user reported hymn numbers being entered
 * -- via the bulk paste tool at /music, and via the agenda grid -- with
 * no title alongside them. Every write path that accepts a bare hymn
 * number now calls this to fill the title in automatically instead of
 * leaving it blank, rather than only ever trusting whatever text (if
 * any) happened to come with the number.
 *
 * Returns a Map keyed by hymn number, missing an entry for any number
 * with no match in Music Reference -- callers should leave the title
 * blank in that case (a genuine gap in Music Reference, or a typo in
 * the number) rather than block the save over it.
 */
export async function lookupHymn1985Titles(hymnNumbers: number[]): Promise<Map<number, string>> {
  const unique = Array.from(new Set(hymnNumbers)).filter((n) => Number.isFinite(n));
  if (unique.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase
    .from("hymnal_songs")
    .select("number, title")
    .eq("songbook", "hymns_1985")
    .in(
      "number",
      unique.map((n) => String(n))
    );

  const map = new Map<number, string>();
  for (const row of (data ?? []) as { number: string; title: string }[]) {
    const n = Number.parseInt(row.number, 10);
    if (Number.isFinite(n)) map.set(n, row.title);
  }
  return map;
}

/** Single-number convenience wrapper around lookupHymn1985Titles, for
 *  the write paths that only ever handle one hymn at a time. */
export async function lookupHymn1985Title(hymnNumber: number): Promise<string | null> {
  const map = await lookupHymn1985Titles([hymnNumber]);
  return map.get(hymnNumber) ?? null;
}
