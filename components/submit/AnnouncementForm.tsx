"use client";

import { useState } from "react";
import {
  ANNOUNCEMENT_ORGANIZATIONS,
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_WHERE,
  ANNOUNCEMENT_TYPES,
  OTHER_VALUE,
  parseMultiSelectValue,
} from "@/lib/data/announcement-constants";
import { RecurrenceToggle } from "@/components/submit/RecurrenceFields";
import { ImageUploadField } from "@/components/ImageUploadField";
import { SubmitButton } from "@/components/submit/SubmitButton";

// text-base, not text-sm (2026-10-31, mobile-friendliness pass) -- iOS
// Safari auto-zooms the whole page on focus for any form control whose
// font-size is under 16px, which text-sm's 14px triggers on every
// field in this form.
const INPUT_CLASS = "rounded border border-rule bg-paper px-3 py-2 text-base text-ink";
const LABEL_CLASS = "text-xs text-ink-muted";

const STATUS_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

/** Renders a fieldset of checkboxes sharing one `name` -- FormData's
 *  getAll(name) on submit collects every box the visitor checked.
 *  `defaultChecked` (2026-11-14, the new form-based editor) pre-checks
 *  whichever values are already saved. */
function CheckboxGroup({
  name,
  options,
  defaultChecked,
}: {
  name: string;
  options: readonly string[];
  defaultChecked?: Set<string>;
}) {
  return (
    <fieldset className="rounded border border-rule px-3 py-2">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {options.map((opt) => (
          <label key={opt} className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" name={name} value={opt} defaultChecked={defaultChecked?.has(opt)} className="mt-0.5" />
            {opt}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A radio-style <select> with a free-text override when "Other" is
 *  picked -- matches the real form's radio + "Other" questions.
 *  `defaultValue` (2026-11-14, the new form-based editor) pre-selects
 *  the saved value, falling back to "Other" + the real saved text when
 *  it doesn't match any of the fixed options -- same "whatever's
 *  stored doesn't have to be in the list" rule Table Admin's own
 *  `select_with_other` column type already established for this exact
 *  shape. */
function RadioSelectWithOther({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultValue?: string | null;
}) {
  const isKnownOption = defaultValue != null && options.some((o) => o.value === defaultValue);
  const [value, setValue] = useState(isKnownOption ? defaultValue! : defaultValue ? OTHER_VALUE : "");
  const initialOtherText = !isKnownOption && defaultValue ? defaultValue : "";
  return (
    <label className={LABEL_CLASS}>
      {label}
      <select
        name={name}
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={`mt-1 block w-full ${INPUT_CLASS}`}
      >
        <option value="" disabled>
          Choose one
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value={OTHER_VALUE}>Other</option>
      </select>
      {value === OTHER_VALUE && (
        <input
          type="text"
          name={`${name}_other`}
          defaultValue={initialOtherText}
          placeholder="Please specify"
          className={`mt-1 block w-full ${INPUT_CLASS}`}
        />
      )}
    </label>
  );
}

export interface AnnouncementFormInitial {
  title: string;
  body: string;
  organization: string | null;
  announcement_type: string | null;
  audience: string | null;
  where_announced: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  location: string | null;
  link_url: string | null;
  image_url: string | null;
  recurrence: string | null;
  recurrence_day_of_week: number | null;
  recurrence_nth_occurrence: number | null;
  recurrence_day_of_month: number | null;
  status: string;
}

/**
 * Announcement submission -- split out of the old combined SubmitForm
 * (2026-09-09) once Agenda Item submission moved to its own
 * login-gated page (see AgendaItemForm). Originally still open to
 * anyone at that point; **also moved behind login 2026-09-09** (same
 * day, the user's own follow-up) -- the "Your email" field dropped
 * here for the same reason it never existed on AgendaItemForm: the
 * submitter is a known signed-in account now, so submitAnnouncement
 * attributes the submission from the session instead of typed-in text.
 *
 * **Optional image field added 2026-11-01** (migration 099, from the
 * Feedback Widget's own suggestion log -- Corey Anderson, 2026-10-11:
 * "upload images to support an event"), scoped to announcements first
 * per the user's own instruction. No `encType` needed -- React's own
 * form-action handling builds a real FormData (Files included)
 * regardless of the form's encoding attribute.
 *
 * **Made pre-fillable for editing, 2026-11-14** (the user's own
 * request: "I would also like a way to edit announcements by using a
 * form like the entry form, rather than just the table"). An optional
 * `initial` prop pre-fills every field from an existing row
 * (`app/announcements/[id]/edit/page.tsx`); every control that was
 * previously always-blank (`RadioSelectWithOther`, `CheckboxGroup`,
 * the recurrence toggle) now accepts a starting value. `mode="edit"`
 * additionally shows a Status select (Published/Archived) that the
 * create form has no equivalent of -- a brand-new submission is
 * always published, per the existing workflow, so there was never a
 * reason to ask for it there.
 */
export function AnnouncementForm({
  onSubmit,
  initial,
  mode = "create",
}: {
  onSubmit: (formData: FormData) => Promise<void>;
  initial?: AnnouncementFormInitial;
  mode?: "create" | "edit";
}) {
  const whereChecked = new Set(parseMultiSelectValue(initial?.where_announced ?? null, ANNOUNCEMENT_WHERE));
  const audienceChecked = new Set(parseMultiSelectValue(initial?.audience ?? null, ANNOUNCEMENT_AUDIENCES));

  return (
    <form action={onSubmit} className="mt-6 flex flex-col gap-3">
      {mode === "edit" && (
        <label className={LABEL_CLASS}>
          Status
          <select name="status" defaultValue={initial?.status ?? "published"} className={`mt-1 block w-full ${INPUT_CLASS}`}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <RadioSelectWithOther
        name="organization"
        label="Which organization is originating this announcement?"
        options={ANNOUNCEMENT_ORGANIZATIONS}
        defaultValue={initial?.organization}
      />

      <div>
        <p className={LABEL_CLASS}>Who does this announcement pertain to?</p>
        <div className="mt-1">
          <CheckboxGroup name="audience" options={ANNOUNCEMENT_AUDIENCES} defaultChecked={audienceChecked} />
        </div>
      </div>

      <div>
        <p className={LABEL_CLASS}>Where should it be announced?</p>
        <div className="mt-1">
          <CheckboxGroup name="where_announced" options={ANNOUNCEMENT_WHERE} defaultChecked={whereChecked} />
        </div>
      </div>

      <RadioSelectWithOther
        name="announcement_type"
        label="What type of announcement is this?"
        options={ANNOUNCEMENT_TYPES}
        defaultValue={initial?.announcement_type}
      />

      <input
        type="text"
        name="title"
        required
        defaultValue={initial?.title}
        placeholder="Announcement Title (short name)"
        className={INPUT_CLASS}
      />
      <textarea name="body" required rows={4} defaultValue={initial?.body} placeholder="Full Description" className={INPUT_CLASS} />

      <RecurrenceToggle
        initial={
          initial
            ? {
                recurring: initial.recurrence != null,
                recurrence: initial.recurrence,
                dayOfWeek: initial.recurrence_day_of_week,
                nthOccurrence: initial.recurrence_nth_occurrence,
                dayOfMonth: initial.recurrence_day_of_month,
              }
            : undefined
        }
      >
        {(recurring) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={LABEL_CLASS}>
              {recurring ? "Series Start Date" : "Start Date"}
              <input type="date" name="start_date" defaultValue={initial?.start_date ?? ""} className={`mt-1 block w-full ${INPUT_CLASS}`} />
            </label>
            <label className={LABEL_CLASS}>
              {recurring ? "Each Occurrence's Start Time" : "Start Time"}
              <input type="time" name="start_time" defaultValue={initial?.start_time ?? ""} className={`mt-1 block w-full ${INPUT_CLASS}`} />
            </label>
            <label className={LABEL_CLASS}>
              {recurring ? "Series End Date (leave blank if ongoing)" : "End Date"}
              <input type="date" name="end_date" defaultValue={initial?.end_date ?? ""} className={`mt-1 block w-full ${INPUT_CLASS}`} />
            </label>
            <label className={LABEL_CLASS}>
              {recurring ? "Each Occurrence's End Time" : "End Time"}
              <input type="time" name="end_time" defaultValue={initial?.end_time ?? ""} className={`mt-1 block w-full ${INPUT_CLASS}`} />
            </label>
          </div>
        )}
      </RecurrenceToggle>

      <input type="text" name="location" defaultValue={initial?.location ?? ""} placeholder="Location" className={INPUT_CLASS} />
      <input type="url" name="link_url" defaultValue={initial?.link_url ?? ""} placeholder="Link to event info" className={INPUT_CLASS} />

      {/* Optional flyer/photo, 2026-11-01 -- same optional-upload
          pattern as the Feedback Widget's own screenshot field. A real
          styled button, not a bare <input type="file">, since
          2026-11-04 -- see ImageUploadField's own comment. Choosing a
          new file on edit replaces the existing one; leaving it blank
          keeps whatever's already saved (see updateAnnouncement). */}
      <ImageUploadField name="image" existingUrl={initial?.image_url ?? null} />

      <SubmitButton />
    </form>
  );
}
