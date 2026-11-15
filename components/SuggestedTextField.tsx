"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MAX_SUGGESTIONS = 50;

/**
 * A free-text field with substring-matched suggestions -- the Teacher
 * field on Teaching Planning (`TeachingGridForm.tsx`) is this
 * component's first real use, 2026-11-14 (the user's own request,
 * narrowed from "person pickers" in general to "speakers and
 * teachers": "is there a way to change fields where names can be
 * entered, but are also dropdown... search... within the whole
 * entry"). `teaching_assignments.teacher_name` is deliberately plain
 * free text, not a person FK (migration 042's own design -- a name, a
 * topic, or both, whatever's useful) -- this doesn't change that:
 * typing something not on the suggestion list is still accepted and
 * saved exactly as typed, same as before. Native `<input list>` +
 * `<datalist>` was considered and rejected for this -- browsers don't
 * consistently filter a datalist's suggestions by substring (some
 * versions match by prefix only, the exact limitation this whole
 * feature exists to get around), so this does the filtering itself in
 * JS instead, the same reliable approach `PersonCombobox.tsx` uses for
 * the person-id-resolving case.
 *
 * Unlike `PersonCombobox`, there's no hidden input/id to resolve --
 * this component's own visible `<input>` IS the real named form field,
 * so whatever's typed (picked from a suggestion or not) is exactly
 * what gets submitted. `onDirty` still exists for the same reason it
 * does there: clicking a suggestion updates this field's value via
 * React state, which fires no native `change` event an ancestor
 * `<form onChange=...>` would otherwise catch.
 */
export function SuggestedTextField({
  name,
  suggestions,
  defaultValue,
  placeholder,
  onDirty,
  className = "rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink",
}: {
  name: string;
  suggestions: string[];
  defaultValue: string;
  placeholder?: string;
  onDirty?: () => void;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const trimmed = value.trim().toLowerCase();
  const filtered = (trimmed ? suggestions.filter((s) => s.toLowerCase().includes(trimmed)) : suggestions).slice(
    0,
    MAX_SUGGESTIONS
  );

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

  function pick(suggestion: string) {
    if (suggestion !== value) onDirty?.();
    setValue(suggestion);
    setOpen(false);
  }

  return (
    <div className="relative min-w-[9rem]">
      <input
        ref={inputRef}
        type="text"
        name={name}
        role="combobox"
        aria-expanded={open}
        aria-controls={panelId}
        aria-autocomplete="list"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setHighlighted(0);
          onDirty?.();
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 0)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // A bare text input submits its enclosing <form> on Enter
            // by default -- this field sits inside a "Save All
            // Changes" form, so that has to be blocked unconditionally.
            e.preventDefault();
            if (open && filtered[highlighted]) pick(filtered[highlighted]);
            else setOpen(false);
          } else if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setHighlighted((h) => Math.max(h - 1, 0));
          }
        }}
        className={`w-full ${className}`}
      />

      {open &&
        position &&
        filtered.length > 0 &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            style={{ position: "fixed", top: position.top, left: position.left, width: Math.max(position.width, 180) }}
            className="z-50 max-h-56 overflow-y-auto rounded border border-rule bg-surface p-1 text-sm text-ink shadow-lg"
          >
            {filtered.map((s, i) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={`block w-full truncate rounded px-2 py-1 text-left ${
                  i === highlighted ? "bg-accent-soft" : "hover:bg-accent-soft"
                }`}
              >
                {s}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
