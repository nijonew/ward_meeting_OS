"use client";

import { useState } from "react";
import type { CadenceShape } from "@/lib/data/cadence";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NTH_NAMES = ["1st", "2nd", "3rd", "4th", "5th"];

export const CADENCE_SELECT_CLASS = "rounded-md border border-rule bg-paper px-2 py-2 text-xs text-ink";

/**
 * The weekly / nth-of-month / relative cadence picker, shared by every
 * cadence-rule feature (Meeting Schedule, Youth Activity Schedule, Ward
 * Event Schedule) -- see lib/data/cadence.ts for the matching date math
 * and field-reading logic this UI feeds into.
 */
export function CadenceFields({
  initialValues,
  defaultCadence,
}: {
  initialValues?: {
    day_of_week?: number | null;
    nth_occurrence?: number | null;
    anchor_day_of_week?: number | null;
    anchor_nth_occurrence?: number | null;
    offset_days?: number | null;
  };
  defaultCadence: CadenceShape;
}) {
  const [cadence, setCadence] = useState<CadenceShape>(defaultCadence);

  return (
    <>
      <select
        name="cadence"
        required
        value={cadence}
        onChange={(e) => setCadence(e.target.value as CadenceShape)}
        className={CADENCE_SELECT_CLASS}
      >
        <option value="weekly">Weekly</option>
        <option value="nth_weekday">Nth of month</option>
        <option value="relative">Relative (e.g. Tue after 3rd Sun)</option>
      </select>

      {cadence === "weekly" && (
        <div className="col-span-2 flex flex-wrap items-center gap-2 text-xs text-slate sm:col-span-4">
          Every
          <select name="day_of_week" required defaultValue={initialValues?.day_of_week ?? ""} className={CADENCE_SELECT_CLASS}>
            <option value="" disabled>
              Day
            </option>
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      {cadence === "nth_weekday" && (
        <div className="col-span-2 flex flex-wrap items-center gap-2 text-xs text-slate sm:col-span-4">
          The
          <select
            name="nth_occurrence"
            required
            defaultValue={initialValues?.nth_occurrence ?? ""}
            className={CADENCE_SELECT_CLASS}
          >
            <option value="" disabled>
              1st&ndash;5th
            </option>
            {NTH_NAMES.map((n, i) => (
              <option key={n} value={i + 1}>
                {n}
              </option>
            ))}
          </select>
          <select name="day_of_week" required defaultValue={initialValues?.day_of_week ?? ""} className={CADENCE_SELECT_CLASS}>
            <option value="" disabled>
              Day
            </option>
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          of the month
        </div>
      )}

      {cadence === "relative" && (
        <div className="col-span-2 flex flex-wrap items-center gap-2 text-xs text-slate sm:col-span-4">
          The
          <select
            name="anchor_nth_occurrence"
            required
            defaultValue={initialValues?.anchor_nth_occurrence ?? ""}
            className={CADENCE_SELECT_CLASS}
          >
            <option value="" disabled>
              1st&ndash;5th
            </option>
            {NTH_NAMES.map((n, i) => (
              <option key={n} value={i + 1}>
                {n}
              </option>
            ))}
          </select>
          <select
            name="anchor_day_of_week"
            required
            defaultValue={initialValues?.anchor_day_of_week ?? ""}
            className={CADENCE_SELECT_CLASS}
          >
            <option value="" disabled>
              Day
            </option>
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <span>plus</span>
          <input
            type="number"
            name="offset_days"
            required
            placeholder="Days"
            defaultValue={initialValues?.offset_days ?? undefined}
            className={`${CADENCE_SELECT_CLASS} w-20`}
          />
          <span>days (negative for &ldquo;before&rdquo;)</span>
        </div>
      )}
    </>
  );
}

export function describeCadence(r: {
  cadence: CadenceShape;
  day_of_week?: number | null;
  nth_occurrence?: number | null;
  anchor_day_of_week?: number | null;
  anchor_nth_occurrence?: number | null;
  offset_days?: number | null;
}): string {
  if (r.cadence === "weekly") {
    return `Every ${DAY_NAMES[r.day_of_week ?? 0]}`;
  }
  if (r.cadence === "nth_weekday") {
    return `${NTH_NAMES[(r.nth_occurrence ?? 1) - 1]} ${DAY_NAMES[r.day_of_week ?? 0]} of the month`;
  }
  const offset = r.offset_days ?? 0;
  const anchor = `${NTH_NAMES[(r.anchor_nth_occurrence ?? 1) - 1]} ${DAY_NAMES[r.anchor_day_of_week ?? 0]}`;
  if (offset === 0) return anchor;
  return `${Math.abs(offset)} day${Math.abs(offset) === 1 ? "" : "s"} ${offset > 0 ? "after" : "before"} the ${anchor}`;
}
