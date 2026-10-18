"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AdminOption } from "@/lib/admin/types";

/**
 * Checkbox-in-dropdown editor for a Table Admin "multi_select" column
 * (2026-10-18, the user's own request: "Can the same options in the
 * submit announcements page be available via dropdown or checkbox in
 * dropdown on the manage announcements page?" -- Audience/Where
 * Announced are the submit form's own checkbox-group questions).
 *
 * Same portal/fixed-position/scroll-closes/outside-click technique as
 * `ColumnFilterDropdown` -- this grid's own wrapping div is
 * `overflow-x-auto`, which clips an ordinary `position: absolute`
 * panel the same way that component's own doc comment describes; see
 * there for the full story. The semantics are different, though:
 * `selected` is literally the set of values currently IN this cell
 * (what gets saved), not an exclusion filter layered over some other
 * list -- so unlike that component, there's no "null means nothing
 * excluded" shortcut, just a plain array the caller already resolved
 * from the stored, joined string.
 */
export function MultiSelectDropdown({
  options,
  selected,
  onChange,
}: {
  options: AdminOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
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

  const selectedSet = new Set(selected);

  function toggleValue(v: string) {
    onChange(selectedSet.has(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  }

  const summary =
    selected.length === 0 ? "None" : options.filter((o) => selectedSet.has(o.value)).map((o) => o.label).join(", ");

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={summary}
        className="block w-full min-w-[6rem] max-w-[16rem] truncate rounded border border-rule bg-paper px-2 py-1 text-left text-xs text-ink"
      >
        {summary}
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: position.top, left: position.left }}
            className="z-50 w-64 rounded border border-rule bg-surface p-2 text-xs text-ink shadow-lg"
          >
            <div className="max-h-60 overflow-y-auto">
              {options.map((o) => (
                <label key={o.value} className="flex items-start gap-1.5 py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(o.value)}
                    onChange={() => toggleValue(o.value)}
                    className="mt-0.5"
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
