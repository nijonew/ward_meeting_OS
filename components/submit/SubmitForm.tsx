"use client";

import { useState } from "react";

const TIME_NEEDED_OPTIONS = ["1-2 Minutes", "3-5 Minutes", "6+ Minutes"];
const INPUT_CLASS = "rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink";

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
      <input
        type="text"
        name="submitted_by_name"
        placeholder={kind === "announcement" ? "Your name" : "Your name (optional)"}
        required={kind === "announcement"}
        className={INPUT_CLASS}
      />

      {kind === "announcement" ? (
        <>
          <input type="text" name="title" required placeholder="Title" className={INPUT_CLASS} />
          <textarea name="body" rows={4} placeholder="Details" className={INPUT_CLASS} />
        </>
      ) : (
        <>
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
