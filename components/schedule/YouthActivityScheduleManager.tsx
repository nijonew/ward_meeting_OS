"use client";

import { useActionState, useEffect, useState } from "react";
import type { YouthActivityScheduleRule } from "@/lib/data/youth-activity-schedule";
import { YOUTH_ACTIVITY_GROUPS, YOUTH_DEVELOPMENT_CATEGORIES } from "@/lib/data/youth-activity-constants";
import { CadenceFields, CADENCE_SELECT_CLASS, describeCadence } from "@/components/schedule/CadenceFields";

type FormResult = { success?: true; error?: string };
const initialFormState: FormResult = {};
type Mode = { kind: "blank" } | { kind: "copy"; rule: YouthActivityScheduleRule } | { kind: "edit"; rule: YouthActivityScheduleRule };

function RuleForm({
  initialValues,
  submitLabel,
  onSubmit,
  onSuccess,
  onCancel,
}: {
  initialValues?: Partial<YouthActivityScheduleRule>;
  submitLabel: string;
  onSubmit: (formData: FormData) => Promise<FormResult>;
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: FormResult, formData: FormData) => onSubmit(formData),
    initialFormState
  );

  useEffect(() => {
    if (state.success) onSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3 border-t border-rule/60 pt-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="text"
          name="title"
          required
          placeholder="Title (e.g. Wednesday Activity)"
          defaultValue={initialValues?.title}
          className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
        <select
          name="group_name"
          required
          defaultValue={initialValues?.group_name ?? ""}
          className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        >
          <option value="" disabled>
            Choose group
          </option>
          {YOUTH_ACTIVITY_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CadenceFields initialValues={initialValues} defaultCadence={initialValues?.cadence ?? "weekly"} />
        <input
          type="time"
          name="activity_time"
          defaultValue={initialValues?.activity_time?.slice(0, 5) ?? ""}
          className={CADENCE_SELECT_CLASS}
        />
        <select
          name="development_category"
          defaultValue={initialValues?.development_category ?? ""}
          className={CADENCE_SELECT_CLASS}
        >
          <option value="">&mdash; Category &mdash;</option>
          {YOUTH_DEVELOPMENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <input
        type="text"
        name="location"
        placeholder="Location (optional)"
        defaultValue={initialValues?.location ?? ""}
        className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
      />

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

export function YouthActivityScheduleManager({
  rules,
  onAdd,
  onUpdate,
  onDelete,
  onToggle,
}: {
  rules: YouthActivityScheduleRule[];
  onAdd: (formData: FormData) => Promise<FormResult>;
  onUpdate: (id: string, formData: FormData) => Promise<FormResult>;
  onDelete: (id: string) => Promise<FormResult>;
  onToggle: (id: string, active: boolean) => Promise<FormResult>;
}) {
  const [mode, setMode] = useState<Mode>({ kind: "blank" });
  const [formKey, setFormKey] = useState(0);

  const resetForm = () => {
    setMode({ kind: "blank" });
    setFormKey((k) => k + 1);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Cadence</h2>

      {rules.length > 0 && (
        <table className="mt-4 w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-rule text-left font-mono text-[10px] uppercase tracking-widest text-slate/70">
              <th className="pb-2 pr-3">Title</th>
              <th className="pb-2 pr-3">Group</th>
              <th className="pb-2 pr-3">Schedule</th>
              <th className="pb-2 pr-3">Active</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-rule/40 last:border-0">
                <td className="py-2 pr-3 text-ink">{r.title}</td>
                <td className="py-2 pr-3 text-slate">{r.group_name}</td>
                <td className="py-2 pr-3 text-slate">{describeCadence(r)}</td>
                <td className="py-2 pr-3">
                  <button
                    type="button"
                    onClick={() => onToggle(r.id, r.active)}
                    className={[
                      "font-mono text-[10px] uppercase tracking-widest",
                      r.active ? "text-sage" : "text-slate/50",
                    ].join(" ")}
                  >
                    {r.active ? "Active" : "Paused"}
                  </button>
                </td>
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode({ kind: "edit", rule: r });
                        setFormKey((k) => k + 1);
                      }}
                      className="text-xs text-slate hover:text-ink"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode({ kind: "copy", rule: r });
                        setFormKey((k) => k + 1);
                      }}
                      className="text-xs text-slate hover:text-ink"
                    >
                      Copy
                    </button>
                    <button type="button" onClick={() => onDelete(r.id)} className="text-xs text-slate hover:text-ink">
                      Delete
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <RuleForm
        key={formKey}
        initialValues={mode.kind === "blank" ? undefined : mode.rule}
        submitLabel={mode.kind === "edit" ? "Save Changes" : "Add Rule"}
        onSubmit={(formData) => (mode.kind === "edit" ? onUpdate(mode.rule.id, formData) : onAdd(formData))}
        onSuccess={resetForm}
        onCancel={mode.kind === "blank" ? undefined : resetForm}
      />
      {mode.kind !== "blank" && (
        <p className="mt-2 text-[11px] text-slate/60">
          {mode.kind === "edit" ? "Editing the rule above." : "Copying the rule above as a starting point for a new one."}
        </p>
      )}
    </div>
  );
}
