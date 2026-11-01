import { createClient } from "@/lib/supabase/server";

export interface CouncilNotes {
  notes: string | null;
  next_meeting_date: string | null;
}

export async function getCouncilNotes(meetingId: string): Promise<CouncilNotes | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("council_notes")
    .select("notes, next_meeting_date")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  return data ?? null;
}

// saveCouncilNotes moved to app/meetings/[id]/council-actions.ts,
// 2026-11-01 -- a per-function inline "use server" directive (as this
// one used to be) only works when the importing module is part of the
// server tree; once CouncilNotesForm.tsx became a Client Component
// (for the combined "Save All Changes" button -- see
// CollaborativeMeetingBody.tsx), it needed a real top-level "use
// server" file instead, matching bishopric-actions.ts's own convention.
