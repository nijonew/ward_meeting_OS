"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getFeatureNavSections } from "@/app/nav-actions";
import type { NavSection } from "@/lib/data/nav-sections";

/**
 * The persistent side navigation (2026-11-05, the user's own request:
 * "With the improved categories, I would like to improve navigation by
 * adding a menu on the side with the categories and the features
 * associated with those categories from our cleanup"). Rendered from
 * `AppHeader` -- which already appears on nearly every page -- so this
 * shows up everywhere that header does, with no per-page wiring
 * needed, and is absent exactly where `AppHeader` already is (the
 * pre-auth pages, and the bare-chrome Sacrament Meeting public-only
 * branch of `app/meetings/[id]/layout.tsx`).
 *
 * A toggle button + slide-in panel + overlay, not a layout column
 * pushing page content over -- adopting that instead would mean
 * reworking every page's own `<main>` wrapper (this app has no shared
 * two-column layout anywhere today), while an overlay drawer only ever
 * needs this one component. Closes on: clicking the overlay, clicking
 * a link, pressing Escape, or navigating away (the pathname comparison
 * below) -- that last one matters because `usePathname()` doesn't
 * force anything to close on its own; without it, following a link
 * that doesn't trigger a real page reload (a client-side Next.js
 * navigation) would leave the drawer sitting open over the new page.
 *
 * `thisWeekSection` arrives already resolved from `AppHeader` (free --
 * built straight from the session check that component already does).
 * Every other category (My meetings/Announcements/Meeting Planning/
 * Youth program/Admin, from `getNavSections()`) is fetched here
 * instead, lazily, the first time the drawer is actually opened --
 * **not** eagerly from `AppHeader` on every page render, 2026-11-08.
 * The first version did fetch everything eagerly; since `AppHeader`
 * renders on nearly every page, that meant every single page load
 * paid for `getVisibleMeetingTypesForUser`'s own queries whether or
 * not anyone ever opened the menu -- the user's own report, right
 * after that shipped: "Sluggish again." Paying that cost only on the
 * actual click, once per page view, is the fix.
 */
export function NavDrawer({ thisWeekSection }: { thisWeekSection: NavSection }) {
  const [open, setOpen] = useState(false);
  const [featureSections, setFeatureSections] = useState<NavSection[] | null>(null);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();

  // Closes on navigation by comparing the path against its own last-
  // seen value DURING render, not inside a `useEffect` -- same
  // "adjust state when a prop changes" pattern this app's own
  // `AgendaGridForm`/`CallingPlanningGridForm` already use for an
  // identical reason: calling `setState` synchronously inside an
  // effect body trips the `react-hooks/set-state-in-effect` lint rule
  // and risks a cascading extra render; React's own documented fix for
  // "reset some state when a prop changes" is this exact comparison,
  // done inline.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function handleOpen() {
    setOpen(true);
    if (featureSections !== null || loading) return;
    setLoading(true);
    const sections = await getFeatureNavSections();
    setFeatureSections(sections);
    setLoading(false);
  }

  const sections = [thisWeekSection, ...(featureSections ?? [])];

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="flex h-8 w-8 shrink-0 flex-col items-center justify-center gap-[3px] rounded border border-rule text-ink-muted transition-colors hover:border-rule-strong hover:text-ink"
      >
        <span className="h-[1.5px] w-4 bg-current" />
        <span className="h-[1.5px] w-4 bg-current" />
        <span className="h-[1.5px] w-4 bg-current" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-rule bg-surface p-5 shadow-lg"
            aria-label="Site navigation"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="text-ink-muted hover:text-ink"
              >
                &times;
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-6">
              {sections.map((section) => (
                <div key={section.title}>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">{section.title}</p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          prefetch={false}
                          onClick={() => setOpen(false)}
                          className="block rounded px-2 py-1.5 text-sm text-ink transition-colors hover:bg-accent-soft"
                        >
                          {link.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {loading && <p className="text-xs text-ink-muted">Loading&hellip;</p>}
            </div>
          </nav>
        </>
      )}
    </>
  );
}
