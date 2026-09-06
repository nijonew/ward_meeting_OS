"use client";

import { generateMeetings } from "@/app/meeting-schedule/actions";
import { GenerateForm } from "@/components/schedule/GenerateForm";

export function GenerateMeetingsForm() {
  return (
    <GenerateForm
      action={generateMeetings}
      heading="Generate Meetings"
      itemLabelSingular="meeting"
      itemLabelPlural="meetings"
    />
  );
}
