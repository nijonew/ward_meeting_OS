"use client";

import { useActionState, useEffect, useState } from "react";
import type { ScheduleRule } from "@/lib/data/meeting-schedule";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NTH_NAMES = ["1st", "2nd", "3rd", "4th", "5th"];

const SELECT_CLASS = "rounded-md border border-rule bg-paper px-2 py-2 text-xs text-ink";

type FormResult = { success?: true; error?: string };
const initialState: FormResult = {};

export function RuleForm({
  meetingTypes,
  initialValues,
  submitLabel,
  onSubmit,
  onSuccess,
  onCancel,
}: {
  meetingTypes: { slug: string; name: string }[];
  initialValues?: Partial<ScheduleRule>;
  submitLabel: string;
  onSubmit: (formData: FormData) => Promise<FormResult>;
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: FormResult, formData: FormData) => onSubmit(formData),
    initialState
  );

  useEffect(() => {
    if (state.success) onSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const cadence = initialValues?.cadence ?? "weekly";

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3 border-t border-rule/60 pt-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <select
          name="meeting_type_id"
          required
          defaultValue={initialValues?.meeting_type_slug ?? ""}
          className={`col-span-2 ${SELECT_CLASS} sm:col-span-1`}
        >
          <option value="" disabled>
            Meeting type
          </option>
          {meetingTypes.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>

        <CadenceFields initialValues={initialValues} defaultCadence={cadence} />

        <input
          type="time"
          name="time_of_day"
          required
          defaultValue={initialValues?.time_of_day?.slice(0, 5)}
          className={SELECT_CLASS}
        />
        <input
          type="number"
          name="duration_minutes"
          required
          min={5}
          step={5}
          placeholder="Minutes"
          defaultValue={initialValues?.duration_minutes}
          className={SELECT_CLASS}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-md bg-ink px-4 py-2 text-xs font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs text-slate hover:text-ink">
            Cancel
          </button>
        )}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

function CadenceFields({
  initialValues,
  defaultCadence,
}: {
  initialValues?: Partial<ScheduleRule>;
  defaultCadence: "weekly" | "nth_weekday" | "relative";
}) {
  const [cadence, setCadence] = useState(defaultCadence);

  return (
    <>
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

      {cadence === "weekly" && (
        <div className="col-span-2 flex flex-wrap items-center gap-2 text-xs text-slate sm:col-span-4">
          Every
          <select name="day_of_week" required defaultValue={initialValues?.day_of_week ?? ""} className={SELECT_CLASS}>
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
            className={SELECT_CLASS}
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
          <select name="day_of_week" required defaultValue={initialValues?.day_of_week ?? ""} className={SELECT_CLASS}>
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
            className={SELECT_CLASS}
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
            className={SELECT_CLASS}
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
            className={`${SELECT_CLASS} w-20`}
          />
          <span>days (negative for &ldquo;before&rdquo;)</span>
        </div>
      )}
    </>
  );
}
