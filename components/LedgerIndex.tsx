/**
 * The signature element from design.md: a small square numeral chip
 * that prefixes a row wherever its position in a sequence is real
 * information (a rotation's upcoming order, a Sunday's place on the
 * teaching calendar, a meeting's place in the dashboard list) -- not a
 * decorative index for every table in the app. `current` marks the one
 * row that's next up (the top of an upcoming-meeting/Sunday list),
 * filled `accent` the same way `LifecycleBadge` fills only the active
 * stage; every other row gets a quiet bordered chip instead.
 */
export function LedgerIndex({ position, current }: { position: number; current?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-[11px] tabular-nums",
        current ? "bg-accent text-surface" : "border border-rule text-ink-muted",
      ].join(" ")}
    >
      {position}
    </span>
  );
}
