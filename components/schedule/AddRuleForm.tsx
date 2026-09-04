"use client";

import { useState } from "react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NTH_NAMES = ["1st", "2nd", "3rd", "4th", "5th"];

const SELECT_CLASS = "rounded-md border border-rule bg-paper px-2 py-2 text-xs text-ink";

export function AddRuleForm({
  meetingTypes,
  onAdd,
}: {
  meetingTypes: { slug: string; name: string }[];
  onAdd: (formData: FormData) => void;
}) {
  const [cadence, setCadence] = useState<"weekly" | "nth_weekday" | "relative">("weekly");

  return (
    <form action={onAdd} className="mt-6 flex flex-col gap-3 border-t border-rule/60 pt-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <select name="meeting_type_id" required defaultValue="" className={`col-span-2 ${SELECT_CLASS} sm:col-span-1`}>
          <option value="" disabled>
            Meeting type
          </option>
          {meetingTypes.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          name="cadence"
          required
          value={cadence}
          onChange={(e) => setCadence(e.target.value as typeof cadence)}
          className={SELECT_CLASS}
        >
          <option value="weekly">Weekly</option>
          <option value="nth_weekday">Nth of month</option>
          <option value="relative">Relative (e.g. Tue after 3rd Sun)</option>
        </select>

        <input type="time" name="time_of_day" required className={SELECT_CLASS} />
        <input
          type="number"
          name="duration_minutes"
          required
          min={5}
          step={5}
          placeholder="Minutes"
          className={SELECT_CLASS}
        />
      </div>

      {cadence === "weekly" && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate">
          Every
          <select name="day_of_week" required defaultValue="" className={SELECT_CLASS}>
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
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate">
          The
          <select name="nth_occurrence" required defaultValue="" className={SELECT_CLASS}>
            <option value="" disabled>
              1st&ndash;5th
            </option>
            {NTH_NAMES.map((n, i) => (
              <option key={n} value={i + 1}>
                {n}
              </option>
            ))}
          </select>
          <select name="day_of_week" required defaultValue="" className={SELECT_CLASS}>
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
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate">
          The
          <select name="anchor_nth_occurrence" required defaultValue="" className={SELECT_CLASS}>
            <option value="" disabled>
              1st&ndash;5th
            </option>
            {NTH_NAMES.map((n, i) => (
              <option key={n} value={i + 1}>
                {n}
              </option>
            ))}
          </select>
          <select name="anchor_day_of_week" required defaultValue="" className={SELECT_CLASS}>
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
            className={`${SELECT_CLASS} w-20`}
          />
          <span>days (negative for &ldquo;before&rdquo;)</span>
        </div>
      )}

      <button
        type="submit"
        className="w-fit rounded-md bg-ink px-4 py-2 text-xs font-medium text-paper transition-colors hover:bg-ink/90"
      >
        Add Rule
      </button>
    </form>
  );
}