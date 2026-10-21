"use client";

import { useActionState } from "react";
import { addSpeakerPrayerHistoryEntry } from "@/app/speaker-prayer-history/actions";
import type { PersonOption } from "@/lib/data/people";

type FormState = { success: true } | { error: string } | null;
const initialState: FormState = null;

/**
 * "Log a missed or pre-app turn" -- the ongoing counterpart to the
 * one-time historical import (migration 079, 2026-10-21), so logging
 * one doesn't require Table Admin.
 */
export function AddEntryForm({ people }: { people: PersonOption[] }) {
  const [state, formAction, pending] = useActionState(addSpeakerPrayerHistoryEntry, initialState);

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-rule/60 pt-4">
      <label className="flex flex-col gap-1 text-[11px] text-ink-muted">
        Person
        <select name="person_id" defaultValue="" required className="rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink">
          <option value="" disabled>
            Choose&hellip;
          </option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-ink-muted">
        Role
        <select name="role" defaultValue="speaker" className="rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink">
          <option value="speaker">Speaker</option>
          <option value="prayer">Prayer</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-ink-muted">
        Date
        <input type="date" name="occurred_on" required className="rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink" />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-[11px] text-ink-muted">
        Notes
        <input type="text" name="notes" className="rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper hover:bg-accent-deep disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add"}
      </button>
      {state && "error" in state && <p className="w-full text-[11px] text-danger">{state.error}</p>}
      {state && "success" in state && <p className="w-full text-[11px] text-ink-muted">Added.</p>}
    </form>
  );
}
