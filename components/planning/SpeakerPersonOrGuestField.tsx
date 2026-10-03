"use client";

import { useState } from "react";
import type { PersonOption } from "@/lib/data/people";

/**
 * "select speakers from a dropdown (all people) or to enter the name of
 * a guest speaker. It will not include a guest name field unless
 * necessary" -- the user's own words, 2026-09-09. Defaults to just the
 * person picker; the guest-name input only exists in the DOM once
 * asked for (and vice versa), rather than always showing both. Purely
 * a display toggle -- both inputs still share the field names
 * saveProgramSpeaker expects, so the parent <form> needs no changes to
 * support either mode.
 *
 * Reused for Visiting Authorities (2026-10-03, "a potential write-in
 * option as well") -- same person-or-guest shape, different copy, via
 * the optional label props below (all default to the original Speaker
 * wording so every existing caller is unaffected).
 */
export function SpeakerPersonOrGuestField({
  people,
  defaultPersonId,
  defaultGuestName,
  personPlaceholder = "Choose speaker",
  guestPlaceholder = "Guest name",
  guestToggleLabel = "Guest speaker instead",
  personToggleLabel = "Choose from People instead",
}: {
  people: PersonOption[];
  defaultPersonId: string;
  defaultGuestName: string;
  personPlaceholder?: string;
  guestPlaceholder?: string;
  guestToggleLabel?: string;
  personToggleLabel?: string;
}) {
  const [showGuest, setShowGuest] = useState(Boolean(defaultGuestName) && !defaultPersonId);

  if (showGuest) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="guest_name"
          defaultValue={defaultGuestName}
          placeholder={guestPlaceholder}
          className="rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
        <input type="hidden" name="person_id" value="" />
        <button type="button" onClick={() => setShowGuest(false)} className="text-xs text-ink-muted hover:text-ink">
          {personToggleLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        name="person_id"
        defaultValue={defaultPersonId}
        className="rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
      >
        <option value="">{personPlaceholder}</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input type="hidden" name="guest_name" value="" />
      <button type="button" onClick={() => setShowGuest(true)} className="text-xs text-ink-muted hover:text-ink">
        {guestToggleLabel}
      </button>
    </div>
  );
}
