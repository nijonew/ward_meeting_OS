import { createClient } from "@/lib/supabase/server";
import { fixedCallingNamesForKey } from "@/lib/data/rotations";
import type { MeetingTypeSlug } from "@/lib/types";

/**
 * "Title + last name" (e.g. "Bishop Nielsen") instead of a person's full
 * name -- 2026-10-21, the user's own request, generalizing how
 * callings.title_prefix was always meant to be used but, per
 * PROJECT_CONTEXT.md, "has no correct usage anywhere in the app" until
 * now. Falls back to the plain full name whenever there's no title to
 * attach (a manual pick unrelated to any calling, or a role that was
 * never calling-based in the first place).
 */
export function formatTitleLastName(fullName: string, titlePrefix: string | null | undefined): string {
  if (!titlePrefix) return fullName;
  const parts = fullName.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  return last ? `${titlePrefix} ${last}` : fullName;
}

/**
 * "Title + FULL name" (e.g. "Elder John Smith"), not title + last name
 * -- 2026-10-31, used only for Visiting Authorities, per the user's
 * own explicit instruction when scoping the Conducting script
 * rewrite: a visitor's full name reads more naturally than a bare
 * last name the ward likely doesn't recognize on its own, unlike the
 * ward's own leaders (formatTitleLastName, above), who everyone
 * already knows by last name alone.
 */
export function formatTitleFullName(fullName: string, titlePrefix: string | null | undefined): string {
  return titlePrefix ? `${titlePrefix} ${fullName}` : fullName;
}

/**
 * Batched resolver for a whole agenda's worth of role/person pairs at
 * once -- one query against `callings`, not one per person, matching this
 * project's own established N+1 performance discipline (see the
 * 2026-10-07 "app is extremely slow" fixes elsewhere in this codebase).
 *
 * For each distinct element key, works out its "candidate calling" set:
 * the existing hardcoded lists for presiding/conducting/visiting_authorities
 * (reusing fixedCallingNamesForKey), or, for any other key, whatever
 * calling_ids that key's own `rotations` row has among its calling-based
 * members (see migration 080). A key with no candidate callings at all
 * contributes nothing to the query and never gets an entry in the result
 * -- its people always display with a plain name.
 *
 * The result only has an entry for a {elementKey, personId} pair when that
 * specific person currently holds one of that key's own candidate
 * callings -- a manual override to someone unrelated, or a person who's
 * since been released from the calling that originally resolved them,
 * correctly falls through to a plain name rather than a stale or
 * incorrect title.
 */
export async function getTitlePrefixesForAssignments(
  meetingTypeSlug: MeetingTypeSlug,
  pairs: { elementKey: string; personId: string }[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (pairs.length === 0) return result;

  const supabase = await createClient();

  const distinctKeys = Array.from(new Set(pairs.map((p) => p.elementKey)));
  const exactNamesByKey = new Map<string, string[]>();
  // Calling-name PREFIXES (e.g. "Stake High Councilor" -- matches every
  // "Stake High Councilor (<area>)" seat at once) -- 2026-10-31, fixed
  // alongside the Conducting rewrite: fixedCallingNamesForKey has
  // always returned a `.prefixes` list too (see Visiting Authorities'
  // own VISITING_AUTHORITY_CALLING_NAME_PREFIXES in rotations.ts), but
  // this function never read it until now, so a prefix-only match
  // (any High Councilor, who has no single exact calling name) could
  // never resolve a title here -- only an exact match (Stake
  // Presidency) could.
  const prefixesByKey = new Map<string, string[]>();
  const callingIdsByKey = new Map<string, string[]>();

  const rotationKeys: string[] = [];
  for (const key of distinctKeys) {
    const fixed = fixedCallingNamesForKey(meetingTypeSlug, key);
    if (fixed) {
      exactNamesByKey.set(key, fixed.exact);
      if (fixed.prefixes.length > 0) prefixesByKey.set(key, fixed.prefixes);
    } else {
      rotationKeys.push(key);
    }
  }

  if (rotationKeys.length > 0) {
    const { data: rotationRows } = await supabase
      .from("rotations")
      .select("element_key, rotation_members(calling_id)")
      .in("element_key", rotationKeys);

    for (const row of (rotationRows ?? []) as unknown[]) {
      const r = row as { element_key: string; rotation_members: { calling_id: string | null }[] | null };
      const ids = Array.from(
        new Set((r.rotation_members ?? []).map((m) => m.calling_id).filter((id): id is string => Boolean(id)))
      );
      if (ids.length > 0) callingIdsByKey.set(r.element_key, ids);
    }
  }

  const allExactNames = Array.from(new Set(Array.from(exactNamesByKey.values()).flat()));
  const allCallingIds = Array.from(new Set(Array.from(callingIdsByKey.values()).flat()));
  const allPrefixes = Array.from(new Set(Array.from(prefixesByKey.values()).flat()));

  if (allExactNames.length === 0 && allCallingIds.length === 0 && allPrefixes.length === 0) return result;

  type CallingLookupRow = { id: string; name: string; title_prefix: string | null; current_holder_id: string | null };
  const callings: CallingLookupRow[] = [];

  if (allExactNames.length > 0 || allCallingIds.length > 0) {
    const orParts: string[] = [];
    if (allExactNames.length > 0) orParts.push(`name.in.(${allExactNames.map((n) => `"${n}"`).join(",")})`);
    if (allCallingIds.length > 0) orParts.push(`id.in.(${allCallingIds.join(",")})`);

    const { data: callingRows } = await supabase
      .from("callings")
      .select("id, name, title_prefix, current_holder_id")
      .eq("active", true)
      .or(orParts.join(","));
    callings.push(...((callingRows ?? []) as CallingLookupRow[]));
  }

  // One `ilike` query per distinct prefix, in parallel -- mirrors
  // computeEligiblePersonIdsForFixedCalling's own identical pattern
  // (lib/data/rotations.ts), just for title display instead of
  // eligibility.
  if (allPrefixes.length > 0) {
    const prefixResults = await Promise.all(
      allPrefixes.map((prefix) =>
        supabase.from("callings").select("id, name, title_prefix, current_holder_id").eq("active", true).ilike("name", `${prefix}%`)
      )
    );
    for (const res of prefixResults) {
      callings.push(...((res.data ?? []) as CallingLookupRow[]));
    }
  }

  const callingsByName = new Map(callings.map((c) => [c.name, c]));
  const callingsById = new Map(callings.map((c) => [c.id, c]));

  for (const { elementKey, personId } of pairs) {
    const key = `${elementKey}::${personId}`;
    if (result.has(key)) continue;

    let titlePrefix: string | null = null;

    const names = exactNamesByKey.get(elementKey);
    if (names && !titlePrefix) {
      const match = names.map((n) => callingsByName.get(n)).find((c) => c?.current_holder_id === personId);
      if (match?.title_prefix) titlePrefix = match.title_prefix;
    }

    const prefixes = prefixesByKey.get(elementKey);
    if (prefixes && !titlePrefix) {
      const match = callings.find((c) => c.current_holder_id === personId && prefixes.some((p) => c.name.startsWith(p)));
      if (match?.title_prefix) titlePrefix = match.title_prefix;
    }

    const ids = callingIdsByKey.get(elementKey);
    if (ids && !titlePrefix) {
      const match = ids.map((id) => callingsById.get(id)).find((c) => c?.current_holder_id === personId);
      if (match?.title_prefix) titlePrefix = match.title_prefix;
    }

    if (titlePrefix) result.set(key, titlePrefix);
  }

  return result;
}
