"use client";

import { useActionState, useTransition } from "react";
import {
  addVisitingAuthority,
  removeVisitingAuthority,
  saveVisitingAuthority,
  type SaveActionResult,
} from "@/app/meetings/[id]/visiting-authorities-actions";
import { SpeakerPersonOrGuestField } from "@/components/planning/SpeakerPersonOrGuestField";
import type { VisitingAuthorityRow } from "@/lib/data/visiting-authorities";
import type { PersonOption } from "@/lib/data/people";

const initialSaveState: SaveActionResult = {};

function Row({
  item,
  meetingId,
  people,
}: {
  item: VisitingAuthorityRow;
  meetingId: string;
  people: PersonOption[];
}) {
  const [removing, startRemove] = useTransition();
  const [state, formAction, pending] = useActionState(
    saveVisitingAuthority.bind(null, item.id, meetingId),
    initialSaveState
  );

  const remove = () => {
    if (!window.confirm("Remove this visiting authority?")) return;
    startRemove(async () => {
      await removeVisitingAuthority(item.id, meetingId);
    });
  };

  return (
    <li className="rounded border border-rule/60 p-3">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <SpeakerPersonOrGuestField
          people={people}
          defaultPersonId={item.personId}
          defaultGuestName={item.guestName}
          personPlaceholder="Choose a visiting authority"
          guestToggleLabel="Write in a name instead"
          personToggleLabel="Choose from the list instead"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={removing}
          className="text-xs text-danger/70 hover:text-danger disabled:opacity-30"
        >
          Remove
        </button>
        {state.error && <p className="w-full text-xs text-danger">{state.error}</p>}
        {!pending && state.success && <p className="w-full text-xs text-success">Saved.</p>}
      </form>
    </li>
  );
}

/**
 * Visiting Authorities, on its own page (/meetings/[id]/visiting-authorities,
 * migration 053, 2026-10-03) -- same reasoning as Ward Business: its own
 * add/remove forms can't nest inside the agenda grid's single big
 * `<form>` (HTML forbids nested forms). A freely add/remove list, each
 * row a calling-restricted person (Stake Presidency + High Council,
 * `people` is already filtered to that list by the page) or a write-in
 * guest name -- "I would like there to be a potential write-in option
 * as well and allow for multiple visiting authorities to be
 * recognized," the user's own words.
 */
export function VisitingAuthoritiesSection({
  meetingId,
  items,
  people,
  canEdit,
}: {
  meetingId: string;
  items: VisitingAuthorityRow[];
  people: PersonOption[];
  canEdit: boolean;
}) {
  const [adding, startAdd] = useTransition();

  const add = () =>
    startAdd(async () => {
      await addVisitingAuthority(meetingId);
    });

  return (
    <div className="rounded border border-rule bg-surface p-6">
      <h2 className="font-display text-xl">Visiting Authorities</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Stake Presidency and High Council members are listed first -- choose &ldquo;Write in a
        name instead&rdquo; for anyone else (an Area Seventy, General Authority, etc.).
      </p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">None recognized yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item) => (
            <Row key={item.id} item={item} meetingId={meetingId} people={people} />
          ))}
        </ul>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={add}
          disabled={adding}
          className="mt-4 rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {adding ? "Adding..." : "+ Add Visiting Authority"}
        </button>
      )}
    </div>
  );
}
