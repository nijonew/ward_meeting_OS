import Link from "next/link";
import type { ReactNode } from "react";

interface TileProps {
  title: string;
  description?: string;
  href?: string;
  comingSoon?: boolean;
}

/**
 * One tile in the landing page's tile grid. If `href` is omitted (or
 * `comingSoon` is set), the tile renders as a disabled/grayed card
 * instead of a link -- same visual language the old dashboard used for
 * not-yet-built meeting types.
 */
export function Tile({ title, description, href, comingSoon }: TileProps) {
  const isDisabled = comingSoon || !href;

  const card = (
    <div
      className={[
        "flex h-full flex-col rounded-lg border px-5 py-4 transition-colors",
        isDisabled ? "border-rule/60" : "border-rule bg-card hover:border-ink/30",
      ].join(" ")}
    >
      <span className={["font-display text-lg", isDisabled ? "text-ink/40" : "text-ink"].join(" ")}>
        {title}
      </span>
      {description && (
        <span className={["mt-1 text-sm", isDisabled ? "text-slate/60" : "text-slate"].join(" ")}>
          {description}
        </span>
      )}
      {isDisabled && (
        <span className="mt-2 font-mono text-[10px] uppercase tracking-widest text-slate/70">
          Coming soon
        </span>
      )}
    </div>
  );

  if (isDisabled) {
    return <li>{card}</li>;
  }

  return (
    <li>
      <Link href={href} className="block h-full">
        {card}
      </Link>
    </li>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</ul>;
}