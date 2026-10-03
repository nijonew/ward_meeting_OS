"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

interface TabDef {
  slug: string;
  label: string;
}

/**
 * The meeting shell's own tab nav (Planning/Conducting/Public or
 * Template/Planning/Live, plus Archived once archived) -- split out of
 * `app/meetings/[id]/layout.tsx` 2026-10-03, per the user's own
 * request: "I would like to see a highlight of the meeting mode tab
 * that the user is in (planning, conducting, public) when on the
 * page." Before this, every tab rendered identically regardless of
 * which page you were actually on (`border-b-2 border-transparent`,
 * unconditionally) -- there was no active-state styling at all.
 *
 * `useSelectedLayoutSegment()` reads which of this layout's own child
 * segments is currently rendered -- a client-only hook, which is why
 * this is its own small Client Component rather than inline in the
 * layout (an async Server Component that awaits the meeting fetch, and
 * can't use client hooks directly).
 */
export function MeetingTabNav({ meetingId, tabs }: { meetingId: string; tabs: readonly TabDef[] }) {
  const activeSegment = useSelectedLayoutSegment();

  return (
    <nav className="mt-6 flex gap-1 border-b border-rule">
      {tabs.map((tab) => {
        const isActive = activeSegment === tab.slug;
        return (
          <Link
            key={tab.slug}
            href={`/meetings/${meetingId}/${tab.slug}`}
            aria-current={isActive ? "page" : undefined}
            className={[
              "border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors",
              isActive ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
