"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Toggles between the read-only "finalized agenda" rendering of a
 * meeting's own Minutes/Action Items/Council Notes and the real,
 * editable forms Planning already uses for them -- 2026-11-05, the
 * user's own request: "include the notes in previous meetings, have
 * everything grayed out as in not allowing changes, and then with the
 * push of a button allow changes for those with the notes writing
 * access." `canEdit` governs whether the button even shows -- a viewer
 * who can only see these sections because the meeting has archived
 * (not because they hold the `<type>_notes` feature themselves) never
 * gets it, same gate Planning itself uses for these forms.
 *
 * **Archived meetings only** -- the caller (`archived/page.tsx`) only
 * renders this component once `meeting.stage === "archived"`; a still-
 * open meeting renders `editable` directly instead, no lock/button at
 * all (2026-11-05, the user's own correction: "I would prefer the
 * unlock button be only in past meetings. Anyone with notes writing
 * access... should be able to write notes in a meeting that has not
 * been archived without having the unlock button"). This component
 * itself doesn't know about `stage` -- it's purely "show a lock/unlock
 * toggle around these two renderings," which the archived case still
 * needs and the live case no longer does.
 *
 * Still the first real way to write notes at all for an account that
 * holds `<type>_notes` but not the broader `<type>_planning` --
 * Planning (the only other place these forms render) is gated on
 * `planning`, not `notes`, so someone with notes-only access had no
 * editing surface anywhere, for any meeting, before this.
 *
 * The locked (read-only) view renders visibly dimmed whenever `canEdit`
 * is true -- a plain visual cue that this specific viewer *could*
 * unlock it, not shown to an ordinary viewer who could never edit it
 * either way.
 */
export function NotesEditToggle({
  canEdit,
  readOnly,
  editable,
}: {
  canEdit: boolean;
  readOnly: ReactNode;
  editable: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="rounded border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5"
          >
            {editing ? "Done Editing" : "Edit Notes"}
          </button>
        </div>
      )}
      {editing ? editable : <div className={canEdit ? "opacity-60" : undefined}>{readOnly}</div>}
    </div>
  );
}
