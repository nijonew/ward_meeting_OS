import Link from "next/link";
import type { ReactNode } from "react";

interface TileProps {
  title: string;
  description?: string;
  href?: string;
  comingSoon?: boolean;
  /** Overrides the disabled-state caption, normally "Coming soon"
   *  (2026-10-07, for a tile that's disabled for a *reason* someone
   *  can act on -- e.g. "Please log in to see youth activities" --
   *  rather than "not built yet"). Only shown while the tile is
   *  disabled. */
  disabledLabel?: string;
}

/**
 * One tile in the landing page's tile grid. If `href` is omitted (or
 * `comingSoon` is set), the tile renders as a disabled/grayed card
 * instead of a link -- same visual language the old dashboard used for
 * not-yet-built meeting types.
 */
export function Tile({ title, description, href, comingSoon, disabledLabel }: TileProps) {
  const isDisabled = comingSoon || !href;

  const card = (
    <div
      className={[
        "flex h-full flex-col rounded border px-5 py-4 transition-colors",
        isDisabled ? "border-rule/60" : "border-rule bg-surface hover:border-rule-strong",
      ].join(" ")}
    >
      <span className={["font-display text-lg", isDisabled ? "text-ink/40" : "text-ink"].join(" ")}>
        {title}
      </span>
      {description && (
        <span className={["mt-1 text-sm", isDisabled ? "text-ink-muted/60" : "text-ink-muted"].join(" ")}>
          {description}
        </span>
      )}
      {isDisabled && (
        <span className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
          {disabledLabel ?? "Coming soon"}
        </span>
      )}
    </div>
  );

  if (isDisabled) {
    return <li>{card}</li>;
  }

  return (
    <li>
      {/* prefetch={false} (2026-10-12, the user's own report: "slow on
          every click, every page" -- traced via the Network tab to a
          flood of background `_rsc=` prefetch fetches, several of them
          taking 5-20+ seconds). Next.js auto-prefetches every visible
          Link by default; a page with a dozen+ tiles (the landing
          page, most hub pages) was firing that many simultaneous
          background requests on every load, queueing up and delaying
          the actual click a user was waiting on. Every route this app
          links to responds in well under 300ms on its own (confirmed
          directly via the Network tab), so there's essentially nothing
          to gain from prefetching here and a lot to lose from the
          request-pileup it was causing. */}
      <Link href={href} prefetch={false} className="block h-full">
        {card}
      </Link>
    </li>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</ul>;
}