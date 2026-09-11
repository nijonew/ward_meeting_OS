import type { ConductingRow } from "@/lib/data/conducting-rows";

/**
 * Read-only presentation for the Conducting view's rows (2026-09-10) --
 * label always shown; the resolved value (if any) right below it; a
 * suggested spoken line (if any) below that, visually distinct (italic,
 * muted) so it reads as a suggestion rather than data. A row with
 * neither (a pure banner like "Title" with only wording, or a divider)
 * just renders whichever pieces it has.
 */
export function ConductingRowList({ rows }: { rows: ConductingRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => {
        if (row.kind === "section") {
          return (
            <p
              key={row.id}
              className="mt-2 border-t-2 border-rule pt-4 font-mono text-[11px] uppercase tracking-wider text-ink-muted/70 first:mt-0 first:border-t-0 first:pt-0"
            >
              {row.label}
            </p>
          );
        }

        return (
          <div key={row.id}>
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">{row.label}</p>
            {row.value && <p className="mt-0.5 text-base text-ink">{row.value}</p>}
            {row.wording && <p className="mt-1 text-sm italic leading-relaxed text-ink-muted">{row.wording}</p>}
          </div>
        );
      })}
    </div>
  );
}
