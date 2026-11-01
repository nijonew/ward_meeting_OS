"use client";

import { useTransition } from "react";
import { toggleDueFlag } from "@/app/speaker-prayer-history/actions";
import type { DueCategory } from "@/lib/data/speaker-prayer-history";

/**
 * One person's "Due" checkbox for one category (migration 097,
 * 2026-11-01, the user's own design) -- used both next to a person's
 * most-recent row in the main history list, and (pre-checked) in the
 * "Due" box itself, so unchecking there works too. Both are
 * independent instances pointing at the same underlying flag -- a
 * plain uncontrolled checkbox is fine here, unlike the uncontrolled-
 * select bugs fixed elsewhere this session, since toggling this flag
 * never reorders or changes the identity of the history entries this
 * checkbox is rendered alongside.
 */
export function DueCheckbox({ personId, category, checked }: { personId: string; category: DueCategory; checked: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      defaultChecked={checked}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.checked;
        startTransition(async () => {
          await toggleDueFlag(personId, category, next);
        });
      }}
      title="Mark as due to reach out to"
      className="h-3.5 w-3.5 accent-accent"
    />
  );
}
