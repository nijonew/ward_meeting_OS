"use client";

import { useMemo, useState, useTransition } from "react";
import { parseBulkMusicText, type ParsedMusicRow } from "@/lib/data/music-parsing";
import { MUSIC_TYPES } from "@/lib/data/sacrament-constants";
import type { PersonOption } from "@/lib/data/people";
import { submitBulkMusicRows } from "@/app/music/actions";

function typeLabel(value: string | null) {
  if (!value) return "—";
  return MUSIC_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function BulkMusicEntry({ people }: { people: PersonOption[] }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedMusicRow[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; count?: number } | null>(null);

  const validCount = useMemo(
    () => (parsed ?? []).filter((r) => r.errors.length === 0).length,
    [parsed]
  );

  function handlePreview() {
    setResult(null);
    setParsed(parseBulkMusicText(text, people));
  }

  function handleSubmit() {
    if (!parsed) return;
    startTransition(async () => {
      const res = await submitBulkMusicRows(parsed);
      if ("error" in res) {
        setResult({ error: res.error });
      } else {
        setResult({ count: res.count });
        setText("");
        setParsed(null);
      }
    });
  }

  return (
    <div className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Bulk Add Music</h2>
      <p className="mt-1 text-xs text-slate">
        Paste rows copied from a spreadsheet: Date, Type, Hymn Number, Piece Name, Performer,
        Group Name, Accompanist. A header row is fine if included. Meetings that don&rsquo;t
        exist yet are created automatically.
      </p>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setParsed(null);
          setResult(null);
        }}
        rows={8}
        placeholder={"8/9/2026\tOpening Hymn\t19\tCome, Come, Ye Saints\n8/9/2026\tMusical Number\t\tHow Great Thou Art\tJane Doe"}
        className="mt-3 block w-full rounded-md border border-rule bg-paper px-3 py-2 font-mono text-xs text-ink"
      />

      <button
        type="button"
        onClick={handlePreview}
        disabled={!text.trim()}
        className="mt-3 rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
      >
        Preview
      </button>

      {parsed && (
        <div className="mt-4">
          <p className="text-xs text-slate">
            {validCount} of {parsed.length} row{parsed.length === 1 ? "" : "s"} ready to submit.
          </p>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-rule text-slate">
                  <th className="py-1.5 pr-3 font-mono uppercase tracking-widest">Date</th>
                  <th className="py-1.5 pr-3 font-mono uppercase tracking-widest">Type</th>
                  <th className="py-1.5 pr-3 font-mono uppercase tracking-widest">Piece</th>
                  <th className="py-1.5 pr-3 font-mono uppercase tracking-widest">Performer</th>
                  <th className="py-1.5 pr-3 font-mono uppercase tracking-widest">Accompanist</th>
                  <th className="py-1.5 font-mono uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((row, i) => (
                  <tr key={i} className="border-b border-rule/40">
                    <td className="py-1.5 pr-3">{row.dateIso ?? (row.dateText || "—")}</td>
                    <td className="py-1.5 pr-3">{typeLabel(row.type) || row.typeText}</td>
                    <td className="py-1.5 pr-3">
                      {row.pieceName ?? "—"}
                      {row.hymnNumber ? ` (Hymn ${row.hymnNumber})` : ""}
                    </td>
                    <td className="py-1.5 pr-3">
                      {row.matchedIndividualName ? (
                        row.matchedIndividualName
                      ) : row.performerText ? (
                        <span className="text-brass">{row.performerText} (unmatched)</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      {row.matchedAccompanistName ??
                        (row.accompanistText ? (
                          <span className="text-brass">{row.accompanistText} (unmatched)</span>
                        ) : (
                          "—"
                        ))}
                    </td>
                    <td className="py-1.5">
                      {row.errors.length > 0 ? (
                        <span className="text-red-600">{row.errors.join("; ")}</span>
                      ) : (
                        <span className="text-sage">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={validCount === 0 || pending}
            className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-50"
          >
            {pending ? "Submitting..." : `Submit ${validCount} row${validCount === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {result?.error && <p className="mt-3 text-sm text-red-600">{result.error}</p>}
      {result?.count !== undefined && (
        <p className="mt-3 text-sm text-ink">
          Submitted {result.count} item{result.count === 1 ? "" : "s"} for Bishopric approval.
        </p>
      )}
    </div>
  );
}
