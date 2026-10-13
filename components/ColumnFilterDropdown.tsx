"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
 * `excluded` tracks which values are *unchecked* (hidden), not which
 * are checked -- `null` means nothing is excluded, i.e. every value is
 * showing (the common/default state, and what a freshly-loaded grid
 * starts in). A real `Set` only ever gets created once at least one
 * value has actually been unchecked, and holds just those -- toggling
 * every value back on collapses it back to `null`.
 *
 * **Deliberately NOT "the set of checked values," 2026-10-12** (a real
 * bug found in production: the user changed a Calling Planning row's
 * Status to "To be announced," and the row silently vanished). Root
 * cause: the original version of this component tracked the opposite
 * -- which values were *shown* -- so a brand-new value that didn't
 * exist in any row the last time this column's filter was touched was
 * never something the user could have checked, and got treated as
 * excluded by default the moment it appeared. Tracking exclusions
 * instead means a value nobody has ever explicitly unchecked is always
 * visible, including one that didn't exist yet when the filter was
 * last set -- matching what a user actually expects ("I didn't hide
 * this, why is it hidden").
 *
 * The caller owns this state and is responsible for computing `values`
 * (every distinct value currently in that column, across the *whole*
 * dataset -- not re-narrowed by other active filters, matching Excel's
 * own default per-column-independent behavior) and for actually
 * filtering rows against it (show a row when `excluded == null ||
 * !excluded.has(value)`); this component only renders the picker and
 * reports back what's excluded.
 *
 * **Rendered through a portal, 2026-10-10** -- the first version
 * positioned its panel `absolute` inside the trigger button's own
 * `relative` wrapper, which both grids this is used in sit inside an
 * `overflow-x-auto` div (needed so a wide table can scroll
 * horizontally on a narrow screen). An ancestor with `overflow-x:
 * auto` also clips the *other* axis, so the panel was opening but
 * rendering invisibly, clipped to nothing -- the user's own report:
 * "a sort was added to each column but not an excel style filter...
 * I also need the filter," i.e. the filter looked entirely absent.
 * Now rendered into `document.body` via `createPortal`, positioned
 * `fixed` at the trigger's own on-screen coordinates (computed with
 * `getBoundingClientRect()` when it opens) -- no ancestor's overflow
 * can clip it. Closes on scroll rather than tracking a live position,
 * since the table itself can scroll horizontally while this is open
 * and a stale-positioned panel floating away from its trigger would be
 * its own bug.
 */
export function ColumnFilterDropdown({
  values,
  excluded,
  onChange,
}: {
  values: string[];
  excluded: Set<string> | null;
  onChange: (next: Set<string> | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.left });

    function handleScroll() {
      setOpen(false);
    }
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("scroll", handleScroll, true);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  const sortedValues = useMemo(
    () => [...values].sort((a, b) => (a || EMPTY_LABEL).localeCompare(b || EMPTY_LABEL, undefined, { numeric: true, sensitivity: "base" })),
    [values]
  );
  const visibleValues = search.trim()
    ? sortedValues.filter((v) => (v || EMPTY_LABEL).toLowerCase().includes(search.trim().toLowerCase()))
    : sortedValues;

  const isChecked = (v: string) => excluded === null || !excluded.has(v);
  const isFiltered = excluded !== null && excluded.size > 0;

  function toggleValue(v: string) {
    const base = excluded === null ? new Set<string>() : new Set(excluded);
    if (base.has(v)) base.delete(v);
    else base.add(v);
    onChange(base.size === 0 ? null : base);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={["ml-1 px-0.5 text-[9px] leading-none", isFiltered ? "text-accent" : "text-ink-muted/50 hover:text-ink"].join(" ")}
        title="Filter this column"
      >
        &#9660;
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: position.top, left: position.left }}
            className="z-50 w-48 rounded border border-rule bg-surface p-2 text-xs normal-case tracking-normal text-ink shadow-lg"
          >
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
              <button
                type="button"
                onClick={() => onChange(new Set(values))}
                className="text-ink-muted underline hover:text-ink"
              >
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
          </div>,
          document.body
        )}
    </>
  );
}
