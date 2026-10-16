"use client";

import { generateMeetings } from "@/app/meeting-schedule/actions";
import { GenerateForm } from "@/components/schedule/GenerateForm";

/**
 * Meeting generation already happens on its own now (2026-10-16, the
 * user's own request: "I don't want to have to generate typical
 * activity or meeting dates... It would be ok to be able to set the
 * cadence/rules somewhere but I don't want to have to generate these
 * events") -- `autoGenerateUpcomingMeetings` (`lib/data/meeting-schedule.ts`)
 * runs on every Dashboard/Calling Planning load, keeping meetings for
 * every active rule above covered roughly 8 weeks out automatically.
 * This note is added here, next to the shared `GenerateForm` rather
 * than inside it, since that same component is also reused by Ward
 * Event Schedule and the general Youth Activity Schedule cadence
 * engine -- neither of which got this automatic treatment, so a note
 * inside the shared component would be wrong on those two pages.
 */
export function GenerateMeetingsForm() {
  return (
    <div>
      <p className="mb-2 text-xs text-ink-muted">
        This already happens on its own, about 8 weeks out, every time anyone views the Dashboard
        or Calling Planning &mdash; use the form below only to generate further ahead than that, or
        right after adding or changing a rule.
      </p>
      <GenerateForm
        action={generateMeetings}
        heading="Generate Meetings"
        itemLabelSingular="meeting"
        itemLabelPlural="meetings"
      />
    </div>
  );
}
