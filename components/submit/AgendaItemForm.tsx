"use client";

const TIME_NEEDED_OPTIONS = ["1-2 Minutes", "3-5 Minutes", "6+ Minutes"];
const INPUT_CLASS = "rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink";

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
 */
export function AgendaItemForm({
  meetingTypes,
  onSubmit,
}: {
  meetingTypes: { slug: string; name: string }[];
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={onSubmit} className="mt-6 flex flex-col gap-3">
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

      <button
        type="submit"
        className="mt-1 w-fit rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
      >
        Submit
      </button>
    </form>
  );
}
