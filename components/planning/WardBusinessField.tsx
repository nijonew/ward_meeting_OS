"use client";

import { useState, useTransition } from "react";
import { deleteRabnmItem } from "@/app/meetings/[id]/planning/actions";
import {
  pullCallingPlanningIntoMeeting,
  removeCallingPlanningFromMeeting,
} from "@/app/meetings/[id]/ward-business-actions";
import type { RabnmRow } from "@/lib/data/sacrament-planning";
import type { CallableCallingItem } from "@/lib/data/calling-planning";

const SELECT = "rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink";

/** One already-pulled-in row -- Remove reverses the Calling Planning
 *  pull (removeCallingPlanningFromMeeting) when `calling_planning_id`
 *  is set, or falls back to the plain deleteRabnmItem for an older row
 *  predating this rework (a manually-added "Other"/Presidency Change
 *  item from before 2026-10-03, which has no such link). */
function ExistingRow({ item, meetingId }: { item: RabnmRow; meetingId: string }) {
  const [removing, startRemove] = useTransition();

  const remove = () =>
    startRemove(async () => {
      if (item.calling_planning_id) {
        await removeCallingPlanningFromMeeting(meetingId, item.calling_planning_id);
      } else {
        await deleteRabnmItem(item.id, meetingId);
      }
    });

  return (
    <tr className="border-t border-rule/40">
      <td className="py-1.5 pr-3">{item.people.length > 0 ? item.people.join(", ") : "—"}</td>
      <td className="py-1.5 pr-3 text-ink-muted">{item.calling_name ?? "—"}</td>
      <td className="py-1.5 text-right">
        <button type="button" onClick={remove} disabled={removing} className="text-xs text-danger/70 hover:text-danger">
          {removing ? "Removing..." : "Remove"}
        </button>
      </td>
    </tr>
  );
}

/**
 * One section (Releases or Callings) -- a compact table of what's
 * already pulled in, plus a single dropdown of every not-yet-announced
 * Calling Planning row for this half (ready-to-announce ones sorted
 * first, as a convenience, but not called out visually -- "less
 * information" per the user's own request). Picking one and clicking
 * Add commits immediately via pullCallingPlanningIntoMeeting, same as
 * before this rework -- it has a real side effect on the Calling
 * Planning row itself, so it can't wait for the grid's own "Save All
 * Changes".
 */
function CallingPlanningSection({
  title,
  kind,
  meetingId,
  existing,
  candidates,
}: {
  title: string;
  kind: "calling" | "release";
  meetingId: string;
  existing: RabnmRow[];
  candidates: CallableCallingItem[];
}) {
  const [selected, setSelected] = useState("");
  const [pending, startPull] = useTransition();

  const sortedCandidates = [...candidates].sort((a, b) => Number(b.ready) - Number(a.ready));

  const pull = () => {
    if (!selected) return;
    startPull(async () => {
      await pullCallingPlanningIntoMeeting(meetingId, selected, kind);
      setSelected("");
    });
  };

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">{title}</p>

      {existing.length > 0 ? (
        <table className="mt-2 w-full text-sm">
          <tbody>
            {existing.map((item) => (
              <ExistingRow key={item.id} item={item} meetingId={meetingId} />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">None yet.</p>
      )}

      {sortedCandidates.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className={SELECT}>
            <option value="">Select from Calling Planning&hellip;</option>
            {sortedCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.personName} &mdash; {c.callingName}
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

/**
 * Ward Business, inline in the agenda grid -- reworked again 2026-10-03
 * per the user's own follow-up ("I still don't like the format"):
 * "appear more like the calling planning table but with less
 * information... select by dropdown a line from the calling planning
 * table in either the release or calling section... Remove the 'other'
 * section." Two sections now, not three -- Releases and Callings, each
 * a compact Person/Calling table plus one dropdown sourced entirely
 * from Calling Planning (every not-yet-announced row for that half,
 * not just the "ready to announce" ones -- unchanged from the previous
 * rework, just no longer split into two separate pickers for it).
 *
 * "Other" (baby blessings, baptisms, mission calls, Aaronic Priesthood,
 * new member records) and the free-form Presidency Change quick-add
 * are both gone -- nothing here is manually typed in anymore, only
 * pulled from Calling Planning. A presidency change is already
 * representable as two ordinary pulls from the same Calling Planning
 * row (its release half into Releases, its new-calling half into
 * Callings), so nothing was lost by dropping the combined type.
 * `RabnmQuickAddForm.tsx` and `addRabnmItem` (the server action it
 * called) are deleted outright, not left unlinked -- same "don't leave
 * a second, now-dead way to do the same thing" principle as every
 * other rework in this file's history. Any pre-existing "Other" or
 * `presidency_change` row from before this cutover still exists in the
 * database and is simply not rendered here anymore -- Table Admin's
 * own `sacrament_rabnm` grid (already registered as a raw-data
 * fallback) remains the way to manage one if that's ever needed.
 */
export function WardBusinessField({
  meetingId,
  items,
  callableCallings,
  callableReleases,
}: {
  meetingId: string;
  items: RabnmRow[];
  callableCallings: CallableCallingItem[];
  callableReleases: CallableCallingItem[];
}) {
  const releaseItems = items.filter((i) => i.type === "release");
  const callingItems = items.filter((i) => i.type === "new_calling");

  return (
    <div className="flex flex-col gap-4">
      <CallingPlanningSection
        title="Releases"
        kind="release"
        meetingId={meetingId}
        existing={releaseItems}
        candidates={callableReleases}
      />
      <CallingPlanningSection
        title="Callings"
        kind="calling"
        meetingId={meetingId}
        existing={callingItems}
        candidates={callableCallings}
      />
    </div>
  );
}
