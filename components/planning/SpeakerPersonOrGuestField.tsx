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
 * wording so every existing caller is unaffected). `personFieldName`/
 * `guestFieldName` default to the original "person_id"/"guest_name" too
 * -- Visiting Authorities' own dynamic row list (VisitingAuthoritiesField,
 * AgendaGridForm.tsx) overrides both, since each row needs its own
 * uniquely-indexed field name rather than a fixed one.
 */
export function SpeakerPersonOrGuestField({
  people,
  allPeople,
  defaultPersonId,
  defaultGuestName,
  personFieldName = "person_id",
  guestFieldName = "guest_name",
  personPlaceholder = "Choose speaker",
  guestPlaceholder = "Guest name",
  guestToggleLabel = "Guest speaker instead",
  personToggleLabel = "Choose from People instead",
}: {
  people: PersonOption[];
  /** The full active-people list, used only to resolve a real name for
   *  `defaultPersonId` when it's not already in `people` (e.g. this
   *  role's own calling-eligible list narrowed them out after a
   *  calling change elsewhere) -- see the option-building logic below
   *  for why the currently-assigned person has to stay selectable
   *  regardless. For a caller whose `people` is already unrestricted,
   *  this can just be the same list. */
  allPeople: PersonOption[];
  defaultPersonId: string;
  defaultGuestName: string;
  personFieldName?: string;
  guestFieldName?: string;
  personPlaceholder?: string;
  guestPlaceholder?: string;
  guestToggleLabel?: string;
  personToggleLabel?: string;
}) {
  const [showGuest, setShowGuest] = useState(Boolean(defaultGuestName) && !defaultPersonId);

  // Always keep the currently-assigned person selectable even if a
  // calling change since makes them no longer "eligible" for this
  // specific role (2026-10-30, found while investigating the user's
  // own report: reassigning a calling made someone "not show up" in a
  // meeting they were actually still assigned to). A plain <select>
  // with no matching <option> for its own current value silently
  // falls back to the FIRST option -- here, the person picker's own
  // placeholder -- which then looks exactly like nothing is assigned.
  // A later "Save All Changes" would make that real: saveAgendaGrid
  // deletes the existing role row and only reinserts one if a person/
  // guest is actually submitted, so an unassigned-looking field that
  // was never really unassigned gets permanently wiped on save.
  const personOptions =
    defaultPersonId && !people.some((p) => p.id === defaultPersonId)
      ? [
          ...people,
          { id: defaultPersonId, name: `${allPeople.find((p) => p.id === defaultPersonId)?.name ?? "Unknown"} (no longer eligible)` },
        ]
      : people;

  if (showGuest) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name={guestFieldName}
          defaultValue={defaultGuestName}
          placeholder={guestPlaceholder}
          className="rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
        <input type="hidden" name={personFieldName} value="" />
        <button type="button" onClick={() => setShowGuest(false)} className="text-xs text-ink-muted hover:text-ink">
          {personToggleLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        name={personFieldName}
        defaultValue={defaultPersonId}
        className="rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
      >
        <option value="">{personPlaceholder}</option>
        {personOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input type="hidden" name={guestFieldName} value="" />
      <button type="button" onClick={() => setShowGuest(true)} className="text-xs text-ink-muted hover:text-ink">
        {guestToggleLabel}
      </button>
    </div>
  );
}
