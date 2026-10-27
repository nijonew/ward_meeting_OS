"use client";

import { useRef, useState, useTransition } from "react";
import {
  addTemplateElement,
  removeTemplateElement,
  setTemplateSlotCount,
  moveTemplateElement,
  saveMeetingAsTemplate,
  type ActionResult,
} from "@/app/meetings/[id]/template-actions";
import type { MeetingElement, TemplateElementRow } from "@/lib/data/meeting-elements";

const SELECT = "rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink";

/**
 * One already-on-the-agenda element -- Set (for a repeatable element's
 * slot count), Up/Down, and Remove, all plain `type="button"` +
 * `useTransition` calls straight to the same `app/meetings/[id]/template-actions.ts`
 * functions the standalone Agenda Elements page
 * (`/meetings/[id]/template`) already uses -- never a real `<form>`,
 * since this whole component renders as a sibling of the agenda
 * grid's own `<form>`(s) on the Planning page, and HTML forbids
 * nested forms (same reasoning Ward Business/RABNM/Visiting
 * Authorities/Speakers & Music already established elsewhere on this
 * same page).
 */
function ElementRow({
  meetingId,
  el,
  isFirst,
  isLast,
}: {
  meetingId: string;
  el: TemplateElementRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const slotRef = useRef<HTMLInputElement>(null);

  const run = (action: () => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(result.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-rule/60 px-3 py-1.5 text-sm">
      <span className="text-ink">{el.label}</span>
      <span className="flex items-center gap-2">
        {el.repeatable && (
          <>
            <input
              ref={slotRef}
              type="number"
              min={1}
              max={el.max_slots ?? undefined}
              defaultValue={el.slot_count ?? 1}
              className={`w-14 ${SELECT}`}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setTemplateSlotCount(meetingId, el.id, Number(slotRef.current?.value ?? 1)))}
              className="text-xs text-ink-muted hover:text-ink disabled:opacity-30"
            >
              Set
            </button>
          </>
        )}
        <button
          type="button"
          disabled={pending || isFirst}
          onClick={() => run(() => moveTemplateElement(meetingId, el.id, "up"))}
          className="text-xs text-ink-muted hover:text-ink disabled:opacity-30"
        >
          &uarr;
        </button>
        <button
          type="button"
          disabled={pending || isLast}
          onClick={() => run(() => moveTemplateElement(meetingId, el.id, "down"))}
          className="text-xs text-ink-muted hover:text-ink disabled:opacity-30"
        >
          &darr;
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => removeTemplateElement(meetingId, el.id))}
          className="text-xs text-danger/70 hover:text-danger disabled:opacity-30"
        >
          Remove
        </button>
      </span>
      {error && <p className="w-full text-[11px] text-danger">{error}</p>}
    </div>
  );
}

/**
 * Add/remove/reorder this meeting's own agenda elements directly from
 * the Planning page, for every meeting type (2026-10-25, the user's
 * own request: "make the elements of all non-sacrament meeting much
 * like the sacrament meeting where elements can be added, removed,
 * reordered in planning and not just in template forms"). Checking
 * the actual code against that request surfaced a real discrepancy
 * worth having settled directly with the user first: Sacrament
 * Meeting's own core elements also required leaving Planning for the
 * separate Agenda Elements page (`/meetings/[id]/template`) before
 * this -- only Teaching Program/Ward Business/Visiting Authorities/
 * Announcements were ever genuinely inline. Confirmed: bring this
 * inline for all four meeting types, and keep the standalone page as
 * a fallback rather than removing it.
 *
 * Collapsed by default -- this is now one more thing on an already
 * full Planning page, and most visits are just filling in values, not
 * restructuring the agenda -- expanding shows the exact same
 * add/remove/reorder/slot-count controls the standalone page has,
 * reading and writing the same `meeting_planned_elements` rows via
 * the same four server actions (already revalidating both
 * `/meetings/[id]/template` and `/meetings/[id]/planning`, so no
 * changes were needed there).
 */
export function AgendaElementsManager({
  meetingId,
  included,
  available,
}: {
  meetingId: string;
  included: TemplateElementRow[];
  available: MeetingElement[];
}) {
  const [expanded, setExpanded] = useState(included.length === 0);
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [savingTemplate, startSaveTemplate] = useTransition();
  const [templateResult, setTemplateResult] = useState<string | null>(null);

  const add = () => {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await addTemplateElement(meetingId, selected);
      if ("error" in result) setError(result.error);
      else setSelected("");
    });
  };

  const saveAsTemplate = () => {
    if (!window.confirm("Save this meeting's current elements as the standing default for every future meeting of this type/format?")) {
      return;
    }
    setTemplateResult(null);
    startSaveTemplate(async () => {
      const result = await saveMeetingAsTemplate(meetingId);
      setTemplateResult("error" in result ? result.error : "Saved as the new default template.");
    });
  };

  return (
    <div className="mt-3 rounded border border-rule/60">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-ink-muted/70 hover:text-ink"
      >
        <span>Manage Agenda Elements ({included.length})</span>
        <span>{expanded ? "Hide" : "Show"}</span>
      </button>

      {expanded && (
        <div className="border-t border-rule/60 p-3">
          {included.length === 0 ? (
            <p className="text-sm text-ink-muted">No elements added yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {included.map((el, idx) => (
                <ElementRow key={el.id} meetingId={meetingId} el={el} isFirst={idx === 0} isLast={idx === included.length - 1} />
              ))}
            </div>
          )}

          {available.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule/40 pt-3">
              <select value={selected} onChange={(e) => setSelected(e.target.value)} className={SELECT}>
                <option value="">Add an element&hellip;</option>
                {available.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={add}
                disabled={!selected || pending}
                className="rounded border border-rule px-2 py-1 text-xs text-ink hover:bg-ink/5 disabled:opacity-50"
              >
                {pending ? "Adding..." : "Add"}
              </button>
              {error && <span className="text-[11px] text-danger">{error}</span>}
            </div>
          )}

          {included.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule/40 pt-3">
              <button
                type="button"
                onClick={saveAsTemplate}
                disabled={savingTemplate}
                className="rounded border border-rule px-2 py-1 text-xs text-ink hover:bg-ink/5 disabled:opacity-50"
              >
                {savingTemplate ? "Saving..." : "Save as Template"}
              </button>
              <span className="text-[11px] text-ink-muted">
                Makes this meeting&rsquo;s current elements the default for every future meeting of this type/format.
              </span>
              {templateResult && <span className="text-[11px] text-ink-muted">{templateResult}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
