"use client";

import { useState } from "react";
import { decodeCreateMeetingValue, encodeCreateMeetingValue, type AdminOption } from "@/lib/admin/types";

const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];
const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

function formatDate(dateIso: string) {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * A calendar for picking "which meeting": clicking the field opens a
 * month grid where only dates that actually have one of the relevant
 * meetings are clickable -- everything else is disabled, so there's no
 * way to land on a date nothing happened on. Resolves back to a specific
 * meetings.id, not just a date, so this only works cleanly once `options`
 * is already scoped to one meeting type (see foreignKey.meetingTypeSlug
 * in lib/admin/registry.ts) -- with more than one type in the list, two
 * meetings can share a date and this falls back to a small pick-one list.
 *
 * When `allowCreate` is on, every date is clickable, not just ones with
 * an existing meeting -- picking an empty date submits a "create at this
 * date" sentinel (see lib/admin/types.ts) instead of a real meeting id;
 * the server resolves it (creating the meeting) at save time. This is
 * what lets planning happen against a future Sunday before that meeting
 * is otherwise created.
 */
export function MeetingDatePicker({
  value,
  options,
  required,
  allowCreate,
  onChange,
}: {
  value: unknown;
  options: AdminOption[];
  required?: boolean;
  allowCreate?: boolean;
  onChange: (value: string | null) => void;
}) {
  const selected = options.find((o) => o.value === value) ?? null;
  const pendingCreateDate = decodeCreateMeetingValue(value);
  const [open, setOpen] = useState(false);
  const [dayPicking, setDayPicking] = useState<string | null>(null);
  const [view, setView] = useState(() => {
    const base = selected?.date ?? pendingCreateDate ?? options[0]?.date ?? TODAY_ISO();
    const d = new Date(`${base}T00:00:00`);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const byDate = new Map<string, AdminOption[]>();
  for (const o of options) {
    if (!o.date) continue;
    const list = byDate.get(o.date) ?? [];
    list.push(o);
    byDate.set(o.date, list);
  }

  const openPicker = () => {
    const base = selected?.date ?? pendingCreateDate ?? options[0]?.date ?? TODAY_ISO();
    const d = new Date(`${base}T00:00:00`);
    setView({ year: d.getFullYear(), month: d.getMonth() });
    setDayPicking(null);
    setOpen(true);
  };

  const shiftMonth = (delta: number) => {
    setView((prev) => {
      const next = prev.month + delta;
      if (next < 0) return { year: prev.year - 1, month: 11 };
      if (next > 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: next };
    });
  };

  const pickDate = (dateStr: string) => {
    const matches = byDate.get(dateStr) ?? [];
    if (matches.length === 1) {
      onChange(matches[0].value);
      setOpen(false);
    } else if (matches.length > 1) {
      setDayPicking(dateStr);
    } else if (allowCreate) {
      onChange(encodeCreateMeetingValue(dateStr));
      setOpen(false);
    }
  };

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }),
  ];

  const triggerLabel = selected
    ? selected.label
    : pendingCreateDate
      ? `New: ${formatDate(pendingCreateDate)}`
      : required
        ? "— choose a date —"
        : "— none —";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPicker}
        className="w-full min-w-[160px] truncate rounded border border-rule bg-paper px-2 py-1 text-left text-xs text-ink"
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-lg border border-rule bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => shiftMonth(-1)} className="px-2 text-slate hover:text-ink">
                &larr;
              </button>
              <p className="font-display text-sm">
                {new Date(view.year, view.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
              <button type="button" onClick={() => shiftMonth(1)} className="px-2 text-slate hover:text-ink">
                &rarr;
              </button>
            </div>

            {allowCreate && (
              <p className="mt-2 text-[11px] text-slate/70">
                Bold dates already have a meeting. Any other date can still be picked -- it&rsquo;ll be created
                when you save.
              </p>
            )}

            <div className="mt-3 grid grid-cols-7 gap-1 text-center font-mono text-[10px] uppercase text-slate/60">
              {WEEKDAY_HEADERS.map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((dateStr, i) => {
                if (!dateStr) return <div key={`blank-${i}`} />;
                const matches = byDate.get(dateStr);
                const clickable = Boolean(matches) || allowCreate;
                const isSelected = selected?.date === dateStr || pendingCreateDate === dateStr;
                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={!clickable}
                    onClick={() => pickDate(dateStr)}
                    title={matches ? matches.map((o) => o.label).join(", ") : undefined}
                    className={[
                      "rounded py-1 text-xs",
                      matches
                        ? "cursor-pointer bg-ink/5 font-medium text-ink hover:bg-ink/10"
                        : clickable
                          ? "cursor-pointer text-slate hover:bg-ink/5"
                          : "cursor-default text-slate/30",
                      isSelected ? "ring-2 ring-ink" : "",
                    ].join(" ")}
                  >
                    {Number(dateStr.slice(-2))}
                  </button>
                );
              })}
            </div>

            {dayPicking && (
              <div className="mt-3 flex flex-col gap-1 border-t border-rule/60 pt-3">
                <p className="text-[11px] text-slate">More than one meeting that day:</p>
                {(byDate.get(dayPicking) ?? []).map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className="rounded border border-rule px-2 py-1 text-left text-xs hover:bg-paper"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-rule/60 pt-3">
              {!required && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="text-xs text-slate hover:text-ink"
                >
                  Clear
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="ml-auto text-xs text-slate hover:text-ink">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
