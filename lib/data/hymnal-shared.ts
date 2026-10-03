/**
 * Pure helpers for resolving a hymn-number field's typed value to its
 * title against Music Reference (hymnal_songs) -- no `createClient`
 * import, so this can run client-side too (see AgendaGridForm.tsx /
 * SacramentProgramSection.tsx, which use it for live pre-fill as a
 * number is typed) as well as server-side (lib/data/hymnal.ts's
 * lookupHymnTitle(s), the save-time fallback every write path that
 * accepts a bare hymn number already used before this).
 *
 * Built 2026-10-03, the user's own request: "If I put in a hymn number
 * please then pre-fill the name next to it with the associated hymn...
 * we need to add a way to distinguish the children's song book numbers
 * from those of the 1985 hymn book. can you add a 'C' prior to the
 * children's song book numbers to distinguish them?" -- the 1985 Hymnal
 * and Hymns for Home and Church never overlap each other by number
 * (confirmed by the user: "this works for the 1985 hymn book and the
 * new hymns which don't overlap in number"), so a bare number alone is
 * unambiguous between those two; only the Children's Songbook's
 * numbering genuinely collides with the 1985 Hymnal's, hence the "C"
 * prefix convention to disambiguate just that one case.
 */

export interface HymnalIndexEntry {
  songbook: string;
  number: string;
  title: string;
}

/** Splits a raw hymn-number field's typed value into which songbook it
 *  means and the bare number to match against Music Reference. Returns
 *  null for a blank/unparseable input (a bare "C" with nothing after
 *  it, for instance). */
export function parseHymnNumberInput(raw: string): { childrens: boolean; number: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const childrensMatch = /^[Cc](.+)$/.exec(trimmed);
  if (childrensMatch) {
    const number = childrensMatch[1].trim();
    return number ? { childrens: true, number } : null;
  }
  return { childrens: false, number: trimmed };
}

/** Resolves a raw hymn-number field's value to its title, given the
 *  full Music Reference index. Returns null when nothing matches --
 *  callers should leave the title field exactly as it was (never clear
 *  it), since a non-match just means a typo, a number not yet in Music
 *  Reference, or an in-progress keystroke. */
export function resolveHymnTitle(raw: string, index: HymnalIndexEntry[]): string | null {
  const parsed = parseHymnNumberInput(raw);
  if (!parsed) return null;
  const hit = parsed.childrens
    ? index.find((e) => e.songbook === "childrens_songbook" && e.number === parsed.number)
    : index.find((e) => e.songbook !== "childrens_songbook" && e.number === parsed.number);
  return hit?.title ?? null;
}
