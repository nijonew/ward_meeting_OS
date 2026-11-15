"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MAX_SUGGESTIONS = 50;

export interface PersonComboboxOption {
  id: string;
  name: string;
}

/**
 * A searchable replacement for a plain person-picker `<select>`
 * (2026-11-14, the user's own request: "is there a way to change
 * fields where names can be entered, but are also dropdown... and to
 * have the entry search not just exactly, but also... within the
 * whole entry" -- narrowed to "person pickers like speakers and
 * teachers" once asked which fields). A native `<select>`'s own
 * built-in typeahead only matches by PREFIX (typing "chris" never
 * finds "Merry Christmas"), which can't be changed for a native
 * element -- this is a real combobox instead: a text input the visitor
 * can type into, with a dropdown of every option whose name CONTAINS
 * what's typed (not just starts with it), filtered live.
 *
 * Still resolves to a specific person id, not free text -- the actual
 * submitted value is a hidden `<input>` with this component's own
 * `name`, updated only when a suggestion is explicitly picked (click/
 * Enter) or the field is cleared to empty and blurred. Typing alone
 * never changes what's submitted; blurring with unconfirmed typed text
 * that doesn't match a pick reverts the visible text back to whatever
 * is still actually selected, so there's never a UI/submitted-value
 * mismatch.
 *
 * The caller is responsible for the "always keep the currently-
 * assigned person selectable even if a calling change since made them
 * ineligible for this role" merge (unchanged from the old `<select>`
 * era -- see `PersonSelect`/`SpeakerPersonOrGuestField`'s own
 * `options` construction) -- this component just searches whatever
 * `options` it's given.
 *
 * **Rendered through a portal**, like `ColumnFilterDropdown.tsx` --
 * every real call site sits inside a wide table wrapped in
 * `overflow-x-auto` (needed so it can scroll horizontally on a narrow
 * screen), and an ancestor with `overflow-x: auto` also clips the
 * OTHER axis -- a plain `position: absolute` panel would render
 * invisibly, clipped to nothing, the exact bug that component's own
 * doc comment already describes hitting once. Positioned `fixed` at
 * the input's own on-screen coordinates instead, so no ancestor's
 * overflow can clip it; closes on scroll rather than tracking a live
 * position, since the table itself can scroll while this is open.
 *
 * **`onDirty` (optional)** -- called whenever a selection actually
 * changes (pick, or clearing to empty), since a React-state-driven
 * value change on a hidden input fires no native `change` event for
 * an ancestor `<form>`'s own `onChange` listener to catch -- same
 * reasoning `MultiPersonSelect.tsx`/`VisitingAuthoritiesField` already
 * documented for the identical problem. Omit it for a caller with no
 * dirty-tracking concept at all (e.g. `SacramentProgramSection.tsx`'s
 * own always-enabled per-item Save buttons).
 */
export function PersonCombobox({
  name,
  options,
  defaultValue,
  placeholder = "Unassigned",
  onDirty,
  className = "rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink",
}: {
  name: string;
  options: PersonComboboxOption[];
  defaultValue: string;
  placeholder?: string;
  onDirty?: () => void;
  className?: string;
}) {
  const nameById = (id: string) => options.find((o) => o.id === id)?.name ?? "";

  const [selectedId, setSelectedId] = useState(defaultValue);
  const [query, setQuery] = useState(nameById(defaultValue));
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const filtered = (
    query.trim() ? options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase())) : options
  ).slice(0, MAX_SUGGESTIONS);

  useEffect(() => {
    if (!open) return;
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 2, left: rect.left, width: rect.width });

    function handleScroll() {
      setOpen(false);
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open]);

  function commit(option: PersonComboboxOption | null) {
    const newId = option?.id ?? "";
    if (newId !== selectedId) onDirty?.();
    setSelectedId(newId);
    setQuery(option?.name ?? "");
    setOpen(false);
  }

  function revertToSelection() {
    setQuery(nameById(selectedId));
    setOpen(false);
  }

  function handleBlur() {
    // A tiny delay so a mousedown-triggered commit (see each
    // suggestion's own onMouseDown below, which calls preventDefault
    // specifically to dodge this) always wins the race if it's in
    // flight; harmless otherwise since commit() already closed the
    // panel by then.
    setTimeout(() => {
      if (query.trim() === "") {
        if (selectedId !== "") onDirty?.();
        setSelectedId("");
        setOpen(false);
        return;
      }
      if (query !== nameById(selectedId)) revertToSelection();
      else setOpen(false);
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // A bare text input submits its enclosing <form> on Enter by
      // default -- every real call site sits inside this app's own
      // "Save All Changes" form, so this has to be blocked
      // unconditionally, not just when a suggestion happens to be
      // highlighted.
      e.preventDefault();
      if (open && filtered[highlighted]) commit(filtered[highlighted]);
      else setOpen(false);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      revertToSelection();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) => Math.max(h - 1, 0));
    }
  }

  return (
    <div className="relative min-w-[10rem]">
      <input type="hidden" name={name} value={selectedId} />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={panelId}
        aria-autocomplete="list"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`w-full ${className}`}
      />

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            style={{ position: "fixed", top: position.top, left: position.left, width: Math.max(position.width, 180) }}
            className="z-50 max-h-56 overflow-y-auto rounded border border-rule bg-surface p-1 text-sm text-ink shadow-lg"
          >
            {selectedId !== "" && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(null);
                }}
                className="block w-full rounded px-2 py-1 text-left text-xs text-ink-muted hover:bg-accent-soft"
              >
                Clear selection
              </button>
            )}
            {filtered.length === 0 && <p className="px-2 py-1 text-xs text-ink-muted">No matches</p>}
            {filtered.map((o, i) => (
              <button
                key={o.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(o);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={`block w-full truncate rounded px-2 py-1 text-left ${
                  i === highlighted ? "bg-accent-soft" : "hover:bg-accent-soft"
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
