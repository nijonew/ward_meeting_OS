"use client";

import { useActionState, useEffect } from "react";
import type { ScheduleRule } from "@/lib/data/meeting-schedule";
import { CadenceFields, CADENCE_SELECT_CLASS } from "@/components/schedule/CadenceFields";

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
          className={`col-span-2 ${CADENCE_SELECT_CLASS} sm:col-span-1`}
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
          className={CADENCE_SELECT_CLASS}
        />
        <input
          type="number"
          name="duration_minutes"
          required
          min={5}
          step={5}
          placeholder="Minutes"
          defaultValue={initialValues?.duration_minutes}
          className={CADENCE_SELECT_CLASS}
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
