"use server";

import { getNavSections, type NavSection } from "@/lib/data/nav-sections";

/**
 * Fetched lazily by `NavDrawer` only once the drawer is actually
 * opened (2026-11-08) -- `AppHeader` used to call `getNavSections()`
 * eagerly on every single page render (it renders on nearly every
 * page in the app), which meant every page load now paid for
 * `getVisibleMeetingTypesForUser`'s own queries even when nobody ever
 * opened the menu. The user's own report, right after that shipped:
 * "Sluggish again." Moving the fetch behind this action means the
 * cost is only paid the moment someone actually clicks the hamburger,
 * not on every page view -- `app/page.tsx`'s own tile grid still calls
 * `getNavSections()` directly and eagerly, since it always needs to
 * show those tiles with no click required.
 */
export async function getFeatureNavSections(): Promise<NavSection[]> {
  return getNavSections();
}
