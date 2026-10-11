"use client";

import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { submitFeedback } from "@/app/feedback-actions";

const initialState: { error?: string; success?: boolean } = {};

/**
 * Persistent "suggest a fix or an upgrade" bar, mounted only on
 * logged-in pages (see app/layout.tsx) -- the fully public, no-login
 * pages (the public Sacrament Meeting program, public announcements)
 * stay exactly as chrome-free as they are today.
 *
 * Collapsed by default to a small bottom-right tab; expands into a
 * short form (Bug/Fix vs. Suggestion/Upgrade, one text field). The
 * current page is captured automatically via `usePathname()`, not
 * user-entered. `showThanks`/`expanded` are reset together on close so
 * reopening the widget later in the same session (it's mounted once at
 * the layout level and persists across client-side navigations) always
 * starts from a blank form rather than a stale success message.
 */
export function FeedbackWidget() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [state, formAction, pending] = useActionState(submitFeedback, initialState);

  // Respond to a fresh action result during render, not in an effect --
  // same pattern established elsewhere in this app (e.g.
  // AssignmentGridForm's dirty-flag reset) for "did this value just
  // change."
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success) setShowThanks(true);
  }

  function collapse() {
    setExpanded(false);
    setShowThanks(false);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-rule bg-surface px-4 py-2 text-xs text-ink-muted shadow-sm transition-colors hover:text-ink"
      >
        Suggest a fix or an upgrade
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 rounded border border-rule bg-surface p-4 shadow-lg">
      {showThanks ? (
        <div>
          <p className="text-sm text-ink">Thanks -- this is in the queue.</p>
          <button
            type="button"
            onClick={collapse}
            className="mt-3 w-fit rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-accent-deep"
          >
            Close
          </button>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="page_path" value={pathname} readOnly />

          <p className="font-display text-sm text-ink">Suggest a fix or an upgrade</p>

          <fieldset className="flex gap-4 text-sm text-ink">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="type" value="bug" defaultChecked />
              Bug / Fix
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="type" value="suggestion" />
              Suggestion / Upgrade
            </label>
          </fieldset>

          <textarea
            name="body"
            required
            rows={4}
            placeholder="What's broken, or what would make this better?"
            className="rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />

          {state.error && <p className="text-xs text-danger">{state.error}</p>}

          <div className="flex items-center justify-between">
            <button type="button" onClick={collapse} className="text-xs text-ink-muted hover:text-ink">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="w-fit rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-60"
            >
              {pending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
