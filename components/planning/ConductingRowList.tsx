import type { ConductingRow } from "@/lib/data/conducting-rows";

/**
 * Read-only presentation for the Conducting view's rows.
 *
 * **Reworked 2026-11-05** (the user's own report, pasting the raw text
 * of a real conducting script to show it directly: "The actual script
 * text is the smallest text, the section title and the data to be
 * presented are larger and stand out more than the actual script and
 * provide a lot of data that is in the script and is unnecessarily
 * repeated"). Confirmed by tracing the pasted text against
 * `buildConductingRows`/`conducting.ts`: wherever a row has both a
 * `value` and a `wording`, `wording` was *always* built by
 * interpolating that exact `value` into a sentence (a hymn number +
 * title, a name, a list of names) -- so showing both ever said the
 * same thing twice, once as a bare fact and once inside the sentence
 * that already contains it. One real, literal instance of this was an
 * outright bug, not just a design tradeoff: each pulled announcement's
 * own row set `label` and `value` to the identical string (its title),
 * which is exactly the "Stake Conference / Stake Conference / <detail>"
 * duplication in the user's own pasted example.
 *
 * Fixed by never showing both -- a row renders `wording` when it has
 * one (a strict superset of `value` in every real case, so nothing is
 * lost), falling back to `value` only for the handful of rows that
 * have only ever been a bare fact with no sentence at all (Presiding,
 * Conducting, Recognize Music, a Speaker's name). Whichever one ends
 * up showing is now the full-size, full-color line -- previously
 * `wording` was deliberately the smaller, italic, muted one (a
 * "suggestion" below the "real" value), which is exactly backwards
 * for a script meant to be read aloud live: the words to actually say
 * are the important line on the row, not the de-emphasized one.
 * Dropped the italic styling too -- legible at speaking speed mattered
 * more here than visually marking it as "spoken text" once it's the
 * only text on the row.
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

        const text = row.wording || row.value;

        return (
          <div key={row.id}>
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">{row.label}</p>
            {text && <p className="mt-0.5 text-base leading-relaxed text-ink">{text}</p>}
          </div>
        );
      })}
    </div>
  );
}
