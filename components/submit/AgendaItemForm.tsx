"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit/SubmitButton";

const TIME_NEEDED_OPTIONS = ["1-2 Minutes", "3-5 Minutes", "6+ Minutes"];
// text-base, not text-sm (2026-10-31, mobile-friendliness pass) -- same
// fix as AnnouncementForm.tsx's identical constant: iOS Safari
// auto-zooms the whole page on focus for any form control under 16px.
const INPUT_CLASS = "rounded border border-rule bg-paper px-3 py-2 text-base text-ink";

/**
 * Agenda item submission -- split out of the old combined SubmitForm
 * and moved behind login (2026-09-09) per the user's request: "make it
 * available only to those who attend meetings." No name/email fields
 * anymore -- the submitter is now a signed-in account, so
 * submitAgendaItem attributes the item from the session (profile
 * display_name/email) instead of trusting typed-in text, matching how
 * every other login-gated action in this app identifies who did what.
 * `meetingTypes` only ever contains the types the current account is
 * actually allowed to submit for (the page filters it; the server
 * action re-checks it too), so there's nothing here a visitor could
 * pick that they don't have access to.
 *
 * **Multiple meeting/date targets, 2026-11-15** (the user's own
 * request: "a way to select multiple meeting dates for agenda items
 * as well as multiple meeting types on multiple dates"). One
 * description/time-needed pair can now go onto several meetings at
 * once -- each row below is its own independent meeting-type + date
 * pick, freely mixing types (e.g. Bishopric Meeting on two different
 * Sundays, plus Ward Council on a third). Rows are plain, uncontrolled
 * `<select>`/`<input type="date">` pairs with the SAME field names
 * (`meeting_type`/`meeting_date`) repeated once per row, rather than a
 * per-row-indexed name -- `submitAgendaItem` zips
 * `formData.getAll("meeting_type")` against `getAll("meeting_date")`
 * positionally, which is reliable because `FormData` always returns
 * same-named fields in document order and every row renders its own
 * type select immediately before its own date input. No persisted
 * uncontrolled state to worry about losing on remove (unlike a
 * Save-All-Changes grid) -- this is a one-shot blank form every time,
 * so a row can be removed from anywhere in the list, not just the
 * last one.
 */
export function AgendaItemForm({
  meetingTypes,
  onSubmit,
}: {
  meetingTypes: { slug: string; name: string }[];
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [rowKeys, setRowKeys] = useState<string[]>(() => [crypto.randomUUID()]);

  const addRow = () => setRowKeys((keys) => [...keys, crypto.randomUUID()]);
  const removeRow = (key: string) => setRowKeys((keys) => (keys.length > 1 ? keys.filter((k) => k !== key) : keys));

  return (
    <form action={onSubmit} className="mt-6 flex flex-col gap-3">
      <p className="text-xs text-ink-muted">
        Meeting(s) this item is for -- add another row for a second date, or a different meeting
        type, if the same item should go onto more than one agenda.
      </p>
      {rowKeys.map((key) => (
        <div key={key} className="flex flex-wrap items-end gap-2 rounded border border-rule/60 p-3">
          <select name="meeting_type" required defaultValue="" className={INPUT_CLASS}>
            <option value="" disabled>
              Meeting type
            </option>
            {meetingTypes.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
          <label className="text-xs text-ink-muted">
            Date of meeting
            <input type="date" name="meeting_date" required className={`mt-1 block w-full ${INPUT_CLASS}`} />
          </label>
          {rowKeys.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(key)}
              className="text-xs text-danger/70 hover:text-danger"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={addRow} className="w-fit text-xs text-ink-muted underline hover:text-ink">
        + Add another meeting
      </button>

      <textarea
        name="description"
        required
        rows={4}
        placeholder="Description of agenda item"
        className={INPUT_CLASS}
      />
      <select name="time_needed" defaultValue="" className={INPUT_CLASS}>
        <option value="">How much time do you need for your item?</option>
        {TIME_NEEDED_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <SubmitButton />
    </form>
  );
}
