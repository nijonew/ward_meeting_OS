"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const EMPTY_LABEL = "(Blanks)";

/**
 * Excel/Google-Sheets-style column filter (2026-10-10, the user's own
 * request: "update the filters to act more like an excel or google
 * sheets filter where values can be selected/deselected... I want it
 * everywhere we have a filter"). Replaces the "type text to narrow"
 * filter box every sortable grid in this app used before this --
 * CallingPlanningGridForm and ActivitiesTable, the only two places
 * that actually had a per-column filter at all (Table Admin's own
 * sortable headers never grew one).
 *
 * `selected` follows Excel's own semantics: `null` means every value
 * is showing (the common/default state, and what a freshly-loaded grid
 * starts in) -- a real `Set` only ever gets created once at least one
 * value has been unchecked. An empty `Set` is a real, valid state too
 * (every box unchecked -- matches every row disappearing, same as
 * Excel), not collapsed back to `null`. The caller owns this state and
 * is responsible for computing `values` (every distinct value
 * currently in that column, across the *whole* dataset -- not
 * re-narrowed by other active filters, matching Excel's own default
 * per-column-independent behavior) and for actually filtering rows
 * against it; this component only renders the picker and reports
 * back what's checked.
 */
export function ColumnFilterDropdown({
  values,
  selected,
  onChange,
}: {
  values: string[];
  selected: Set<string> | null;
  onChange: (next: Set<string> | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const sortedValues = useMemo(
    () => [...values].sort((a, b) => (a || EMPTY_LABEL).localeCompare(b || EMPTY_LABEL, undefined, { numeric: true, sensitivity: "base" })),
    [values]
  );
  const visibleValues = search.trim()
    ? sortedValues.filter((v) => (v || EMPTY_LABEL).toLowerCase().includes(search.trim().toLowerCase()))
    : sortedValues;

  const isChecked = (v: string) => selected === null || selected.has(v);
  const isFiltered = selected !== null && selected.size < values.length;

  function toggleValue(v: string) {
    const base = selected === null ? new Set(values) : new Set(selected);
    if (base.has(v)) base.delete(v);
    else base.add(v);
    onChange(base.size === values.length ? null : base);
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={["ml-1 px-0.5 text-[9px] leading-none", isFiltered ? "text-accent" : "text-ink-muted/50 hover:text-ink"].join(" ")}
        title="Filter this column"
      >
        &#9660;
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded border border-rule bg-surface p-2 text-xs normal-case tracking-normal text-ink shadow-lg">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="mb-2 w-full rounded border border-rule/60 bg-paper px-1.5 py-1 text-[11px] text-ink"
          />
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <button type="button" onClick={() => onChange(null)} className="text-ink-muted underline hover:text-ink">
              Select all
            </button>
            <button type="button" onClick={() => onChange(new Set())} className="text-ink-muted underline hover:text-ink">
              Clear
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {visibleValues.length === 0 && <p className="text-ink-muted/60">No matches</p>}
            {visibleValues.map((v) => (
              <label key={v || "__blank__"} className="flex items-center gap-1.5 py-0.5">
                <input type="checkbox" checked={isChecked(v)} onChange={() => toggleValue(v)} />
                <span className="truncate">{v || EMPTY_LABEL}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
