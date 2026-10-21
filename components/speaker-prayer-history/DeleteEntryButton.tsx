"use client";

import { useTransition } from "react";
import { deleteSpeakerPrayerHistoryEntry } from "@/app/speaker-prayer-history/actions";

/** Only ever shown for a speaker_prayer_history_import row -- an
 *  archived-meeting-sourced entry has no delete control here at all,
 *  since it's owned by that meeting, not this table. */
export function DeleteEntryButton({ entryId }: { entryId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Remove this entry?")) return;
        startTransition(async () => {
          await deleteSpeakerPrayerHistoryEntry(entryId);
        });
      }}
      className="text-[10px] text-danger/70 hover:text-danger disabled:opacity-50"
    >
      Remove
    </button>
  );
}
