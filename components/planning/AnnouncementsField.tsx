"use client";

import { useState, useTransition } from "react";
import { pullAnnouncementIntoMeeting, removeAnnouncementFromMeeting } from "@/app/meetings/[id]/announcements-actions";
import type { PulledAnnouncement } from "@/lib/data/sacrament-announcements";

const SELECT = "rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink";

function ExistingRow({ item, meetingId }: { item: PulledAnnouncement; meetingId: string }) {
  const [removing, startRemove] = useTransition();

  const remove = () =>
    startRemove(async () => {
      await removeAnnouncementFromMeeting(meetingId, item.id);
    });

  return (
    <tr className="border-t border-rule/40">
      <td className="py-1.5 pr-3">{item.title}</td>
      <td className="py-1.5 pr-3 text-ink-muted">{item.organization ?? "—"}</td>
      <td className="py-1.5 text-right">
        <button type="button" onClick={remove} disabled={removing} className="text-xs text-danger/70 hover:text-danger">
          {removing ? "Removing..." : "Remove"}
        </button>
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

  const pull = () => {
    if (!selected) return;
    startPull(async () => {
      await pullAnnouncementIntoMeeting(meetingId, selected, plannedElementId);
      setSelected("");
    });
  };

  return (
    <div>
      {items.length > 0 ? (
        <table className="w-full text-sm">
          <tbody>
            {items.map((item) => (
              <ExistingRow key={item.id} item={item} meetingId={meetingId} />
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
        </div>
      )}
    </div>
  );
}
