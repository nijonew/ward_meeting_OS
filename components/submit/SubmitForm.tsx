"use client";

import { useState } from "react";
import {
  ANNOUNCEMENT_ORGANIZATIONS,
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_WHERE,
  ANNOUNCEMENT_TYPES,
  OTHER_VALUE,
} from "@/lib/data/announcement-constants";

const TIME_NEEDED_OPTIONS = ["1-2 Minutes", "3-5 Minutes", "6+ Minutes"];
const INPUT_CLASS = "rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink";
const LABEL_CLASS = "text-xs text-slate";

/** Renders a fieldset of checkboxes sharing one `name` -- FormData's
 *  getAll(name) on submit collects every box the visitor checked. */
function CheckboxGroup({ name, options }: { name: string; options: readonly string[] }) {
  return (
    <fieldset className="rounded-md border border-rule px-3 py-2">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {options.map((opt) => (
          <label key={opt} className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" name={name} value={opt} className="mt-0.5" />
            {opt}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A radio-style <select> with a free-text override when "Other" is
 *  picked -- matches the real form's radio + "Other" questions. */
function RadioSelectWithOther({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
}) {
  const [value, setValue] = useState("");
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
          placeholder="Please specify"
          className={`mt-1 block w-full ${INPUT_CLASS}`}
        />
      )}
    </label>
  );
}

export function SubmitForm({
  meetingTypes,
  onSubmitAnnouncement,
  onSubmitAgendaItem,
}: {
  meetingTypes: { slug: string; name: string }[];
  onSubmitAnnouncement: (formData: FormData) => Promise<void>;
  onSubmitAgendaItem: (formData: FormData) => Promise<void>;
}) {
  const [kind, setKind] = useState<"announcement" | "agenda_item">("announcement");

  return (
    <form
      action={kind === "announcement" ? onSubmitAnnouncement : onSubmitAgendaItem}
      className="mt-6 flex flex-col gap-3"
    >
      <fieldset className="flex gap-4 text-sm text-slate">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={kind === "announcement"}
            onChange={() => setKind("announcement")}
          />{" "}
          Announcement
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={kind === "agenda_item"}
            onChange={() => setKind("agenda_item")}
          />{" "}
          Agenda Item
        </label>
      </fieldset>

      <input
        type="email"
        name="submitted_by_email"
        required
        placeholder="Your email"
        className={INPUT_CLASS}
      />

      {kind === "announcement" ? (
        <>
          <RadioSelectWithOther
            name="organization"
            label="Which organization is originating this announcement?"
            options={ANNOUNCEMENT_ORGANIZATIONS}
          />

          <div>
            <p className={LABEL_CLASS}>Who does this announcement pertain to?</p>
            <div className="mt-1">
              <CheckboxGroup name="audience" options={ANNOUNCEMENT_AUDIENCES} />
            </div>
          </div>

          <div>
            <p className={LABEL_CLASS}>Where should it be announced?</p>
            <div className="mt-1">
              <CheckboxGroup name="where_announced" options={ANNOUNCEMENT_WHERE} />
            </div>
          </div>

          <RadioSelectWithOther
            name="announcement_type"
            label="What type of announcement is this?"
            options={ANNOUNCEMENT_TYPES}
          />

          <input type="text" name="title" required placeholder="Announcement Title (short name)" className={INPUT_CLASS} />
          <textarea name="body" required rows={4} placeholder="Full Description" className={INPUT_CLASS} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={LABEL_CLASS}>
              Start Date
              <input type="date" name="start_date" className={`mt-1 block w-full ${INPUT_CLASS}`} />
            </label>
            <label className={LABEL_CLASS}>
              Start Time
              <input type="time" name="start_time" className={`mt-1 block w-full ${INPUT_CLASS}`} />
            </label>
            <label className={LABEL_CLASS}>
              End Date
              <input type="date" name="end_date" className={`mt-1 block w-full ${INPUT_CLASS}`} />
            </label>
            <label className={LABEL_CLASS}>
              End Time
              <input type="time" name="end_time" className={`mt-1 block w-full ${INPUT_CLASS}`} />
            </label>
          </div>

          <input type="text" name="location" placeholder="Location" className={INPUT_CLASS} />
          <input type="url" name="link_url" placeholder="Link to event info" className={INPUT_CLASS} />
        </>
      ) : (
        <>
          <input
            type="text"
            name="submitted_by_name"
            placeholder="Your name (optional)"
            className={INPUT_CLASS}
          />
          <select name="meeting_type" required defaultValue="" className={INPUT_CLASS}>
            <option value="" disabled>
              Desired meeting for this agenda item
            </option>
            {meetingTypes.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
          <label className="text-xs text-slate">
            Date of meeting
            <input type="date" name="meeting_date" required className={`mt-1 block w-full ${INPUT_CLASS}`} />
          </label>
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
        </>
      )}

      <button
        type="submit"
        className="mt-1 w-fit rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
      >
        Submit
      </button>
    </form>
  );
}
