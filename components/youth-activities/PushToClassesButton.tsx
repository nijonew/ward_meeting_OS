"use client";

import { useState, useTransition } from "react";
import { pushCombinedActivityToClasses } from "@/app/youth-activities/actions";

/**
 * "a button to command that the combined activity overwrite the
 * activity on the same date of the appropriate groups" (the user's own
 * request, 2026-10-11). `label` is the plain-English list of target
 * classes, already resolved from the row's own group_name by the
 * caller (ActivitiesTable) via classesForCombinedGroup -- this
 * component itself has no opinion on which classes those are.
 *
 * A direct useTransition call rather than a <form>, same reasoning as
 * every other per-row action button in this app's grids (e.g.
 * CallingPlanningGridForm's Remove) -- this sits inside a <table> that
 * ActivitiesTable does not wrap in its own <form>, so there's no
 * nesting concern either way, but the pattern is kept consistent
 * regardless. Shows its own inline result message since pushing a copy
 * out to other classes changes nothing visible on the Combined row
 * shown on *this* page -- without it, there'd be no feedback at all
 * that anything happened.
 */
export function PushToClassesButton({ activityId, label }: { activityId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const onClick = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await pushCombinedActivityToClasses(activityId);
      if ("error" in result) {
        setMessage({ text: result.error, isError: true });
      } else {
        setMessage({ text: `Overwrote ${label}.`, isError: false });
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-xs text-ink-muted hover:text-ink disabled:opacity-50"
        title={`Overwrite ${label}'s own activity on this date with this one`}
      >
        {pending ? "Overwriting..." : `Overwrite ${label}`}
      </button>
      {message && <span className={`text-[10px] ${message.isError ? "text-danger" : "text-success"}`}>{message.text}</span>}
    </div>
  );
}
