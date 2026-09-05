"use client";

import { useState } from "react";
import type { ScheduleRule } from "@/lib/data/meeting-schedule";
import { RuleForm } from "@/components/schedule/AddRuleForm";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NTH_NAMES = ["1st", "2nd", "3rd", "4th", "5th"];

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function describeSchedule(r: Pick<ScheduleRule, "cadence" | "day_of_week" | "nth_occurrence" | "anchor_day_of_week" | "anchor_nth_occurrence" | "offset_days">): string {
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

type FormResult = { success?: true; error?: string };
type Mode = { kind: "blank" } | { kind: "copy"; rule: ScheduleRule } | { kind: "edit"; rule: ScheduleRule };

export function RulesManager({
  rules,
  meetingTypes,
  onAdd,
  onUpdate,
  onDelete,
  onToggle,
}: {
  rules: ScheduleRule[];
  meetingTypes: { slug: string; name: string }[];
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
              <th className="pb-2 pr-3">Meeting Type</th>
              <th className="pb-2 pr-3">Schedule</th>
              <th className="pb-2 pr-3">Time</th>
              <th className="pb-2 pr-3">Duration</th>
              <th className="pb-2 pr-3">Active</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-rule/40 last:border-0">
                <td className="py-2 pr-3 text-ink">{r.meeting_type_name}</td>
                <td className="py-2 pr-3 text-slate">{describeSchedule(r)}</td>
                <td className="py-2 pr-3 text-slate">{formatTime(r.time_of_day)}</td>
                <td className="py-2 pr-3 text-slate">{r.duration_minutes} min</td>
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
        meetingTypes={meetingTypes}
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
