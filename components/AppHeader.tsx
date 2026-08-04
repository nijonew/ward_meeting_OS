import Link from "next/link";

/**
 * Shared top bar: wordmark (links home) + a right-aligned context tag.
 * Extracted out of the landing page so the dashboard (and future pages)
 * don't duplicate this markup.
 */
export function AppHeader({ tag }: { tag: string }) {
  return (
    <header className="flex items-baseline justify-between border-b border-rule pb-6">
      <Link href="/" className="font-display text-xl tracking-tight">
        Ward Meeting OS
      </Link>
      <span className="font-mono text-xs uppercase tracking-widest text-slate">{tag}</span>
    </header>
  );
}
