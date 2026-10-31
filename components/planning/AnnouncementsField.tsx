"use client";

import { useState, useTransition } from "react";
import {
  pullAnnouncementIntoMeeting,
  removeAnnouncementFromMeeting,
  moveAnnouncementPull,
} from "@/app/meetings/[id]/announcements-actions";
import type { PulledAnnouncement } from "@/lib/data/sacrament-announcements";

const SELECT = "rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink";

/** Move Up/Down (2026-10-30, the user's own request: "I need to be able
 *  to put announcements in order also in sacrament meetings") -- same
 *  plain `type="button"` + `useTransition` convention as
 *  WardBusinessField.tsx's own reorder controls, scoped to this one
 *  block (`plannedElementId`) so each Announcements block on a meeting
 *  reorders independently. */
function ExistingRow({
  item,
  meetingId,
  plannedElementId,
  isFirst,
  isLast,
}: {
  item: PulledAnnouncement;
  meetingId: string;
  plannedElementId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [removing, startRemove] = useTransition();
  const [moving, startMove] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    setError(null);
    startRemove(async () => {
      const result = await removeAnnouncementFromMeeting(meetingId, item.id);
      if ("error" in result) setError(result.error);
    });
  };

  const move = (direction: "up" | "down") => {
    setError(null);
    startMove(async () => {
      const result = await moveAnnouncementPull(meetingId, item.id, plannedElementId, direction);
      if ("error" in result) setError(result.error);
    });
  };

  return (
    <tr className="border-t border-rule/40">
      <td className="py-1.5 pr-3">{item.title}</td>
      <td className="py-1.5 pr-3 text-ink-muted">{item.organization ?? "—"}</td>
      <td className="py-1.5 text-right">
        <span className="inline-flex items-center gap-2">
          <button
            type="button"
            disabled={moving || isFirst}
            onClick={() => move("up")}
            className="text-xs text-ink-muted hover:text-ink disabled:opacity-30"
          >
            &uarr;
          </button>
          <button
            type="button"
            disabled={moving || isLast}
            onClick={() => move("down")}
            className="text-xs text-ink-muted hover:text-ink disabled:opacity-30"
          >
            &darr;
          </button>
          <button type="button" onClick={remove} disabled={removing} className="text-xs text-danger/70 hover:text-danger">
            {removing ? "Removing..." : "Remove"}
          </button>
        </span>
        {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
      </td>
    </tr>
  );
}

/**
 * "I want to be able to select the announcements that need to be
 * included in sacrament meeting from the list of announcements by
 * title in a dropdown or checkbox or something" (the user's own
 * request, 2026-10-11) -- same shape as WardBusinessField's own
 * Calling-Planning pickers (a compact table of what's already pulled
 * in, plus one dropdown of everything still available), since this is
 * the same kind of action: pulling a row from a general pool into this
 * one meeting, with a real side effect (announcements.meeting_id) that
 * can't wait for the surrounding grid's own "Save All Changes."
 *
 * **One meeting can now have more than one of these, 2026-10-11** (see
 * migration 074's own header) -- `plannedElementId` is which specific
 * block this instance is ("row.id" from the `announcements` AgendaRow,
 * which already IS the `meeting_planned_elements` row id), passed
 * straight through to `pullAnnouncementIntoMeeting` so a pull lands in
 * the right block rather than an ambiguous "this meeting" link.
 *
 * **Bug found and fixed 2026-10-15** (the user's own report: "I added
 * an announcement in the sacrament meeting planning view and it didn't
 * save"): `pull`'s result was discarded entirely, same bug class as
 * Delete Meeting's own silent-failure bug fixed earlier this session
 * (`DeleteMeetingButton.tsx`) -- a failed pull (wrong feature, an RLS
 * denial, or losing a race against another block for the same
 * announcement, which `pullAnnouncementIntoMeeting`'s own
 * `.is("meeting_id", null)` guard would reject) looked identical to a
 * successful one: the dropdown still cleared back to blank either way,
 * with nothing on screen saying it didn't actually land. Now reads the
 * result and shows the message inline if there is one, same pattern as
 * `ExistingRow`'s own Remove button just below.
 */
export function AnnouncementsField({
  meetingId,
  plannedElementId,
  items,
  pullable,
}: {
  meetingId: string;
  plannedElementId: string;
  items: PulledAnnouncement[];
  pullable: PulledAnnouncement[];
}) {
  const [selected, setSelected] = useState("");
  const [pending, startPull] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pull = () => {
    if (!selected) return;
    setError(null);
    startPull(async () => {
      const result = await pullAnnouncementIntoMeeting(meetingId, selected, plannedElementId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSelected("");
    });
  };

  return (
    <div>
      {items.length > 0 ? (
        <table className="w-full text-sm">
          <tbody>
            {items.map((item, index) => (
              <ExistingRow
                key={item.id}
                item={item}
                meetingId={meetingId}
                plannedElementId={plannedElementId}
                isFirst={index === 0}
                isLast={index === items.length - 1}
              />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-ink-muted">None selected yet.</p>
      )}

      {pullable.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className={SELECT}>
            <option value="">Select an announcement&hellip;</option>
            {pullable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={pull}
            disabled={!selected || pending}
            className="rounded border border-rule px-2 py-1 text-xs text-ink hover:bg-ink/5 disabled:opacity-50"
          >
            {pending ? "Adding..." : "Add"}
          </button>
          {error && <span className="text-[11px] text-danger">{error}</span>}
        </div>
      )}
    </div>
  );
}
