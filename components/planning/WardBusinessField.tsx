"use client";

import { useState, useTransition } from "react";
import { deleteRabnmItem } from "@/app/meetings/[id]/planning/actions";
import {
  pullCallingPlanningIntoMeeting,
  removeCallingPlanningFromMeeting,
} from "@/app/meetings/[id]/ward-business-actions";
import { RABNM_TYPES } from "@/lib/data/sacrament-constants";
import type { RabnmRow } from "@/lib/data/sacrament-planning";
import type { CallableCallingItem } from "@/lib/data/calling-planning";
import type { PersonOption } from "@/lib/data/people";
import type { CallingOption } from "@/lib/data/callings";
import { RabnmQuickAddForm } from "@/components/planning/RabnmQuickAddForm";

const OTHER_TYPES = RABNM_TYPES.filter((t) => !["release", "new_calling", "presidency_change"].includes(t.value));

function typeLabel(value: string) {
  return RABNM_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** One already-saved item -- Remove reverses the Calling Planning pull
 *  (removeCallingPlanningFromMeeting) when it came from there
 *  (`calling_planning_id` set), or just deletes the row
 *  (deleteRabnmItem) for a manually-added "Other"/Presidency Change
 *  item, which has no Calling Planning row to reset. */
function ExistingItem({ item, meetingId }: { item: RabnmRow; meetingId: string }) {
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
    <li className="flex flex-wrap items-center justify-between gap-2 rounded border border-rule/60 px-3 py-2 text-sm">
      <span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">{typeLabel(item.type)}</span>{" "}
        {item.people.length > 0 && <span>{item.people.join(", ")}</span>}
        {item.calling_name && <span> &middot; {item.calling_name}</span>}
        {item.detail && <span className="text-ink-muted"> ({item.detail})</span>}
      </span>
      <button type="button" onClick={remove} disabled={removing} className="text-xs text-danger/70 hover:text-danger">
        {removing ? "Removing..." : "Remove"}
      </button>
    </li>
  );
}

/** The "ready to announce" suggestions + "call in another" picker for
 *  one Calling Planning half (Callings or Releases) -- see
 *  getCallableCallingPlanningItems' own comment (lib/data/calling-planning.ts)
 *  for exactly what counts as ready vs. callable. Pulling either one
 *  in is an immediate action (pullCallingPlanningIntoMeeting), not
 *  something deferred to the grid's own "Save All Changes" -- it has a
 *  real side effect on the Calling Planning row itself, so it needs to
 *  commit the moment it's clicked, the same way the existing push from
 *  Calling Planning's own page already does. */
function CallablePicker({
  meetingId,
  kind,
  items,
}: {
  meetingId: string;
  kind: "calling" | "release";
  items: CallableCallingItem[];
}) {
  const [pending, startPull] = useTransition();
  const [selected, setSelected] = useState("");
  const ready = items.filter((i) => i.ready);
  const callable = items.filter((i) => !i.ready);

  const pull = (planningId: string) =>
    startPull(async () => {
      await pullCallingPlanningIntoMeeting(meetingId, planningId, kind);
      setSelected("");
    });

  if (items.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {ready.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            {item.personName} <span className="text-ink-muted">&middot; {item.callingName}</span>
          </span>
          <button
            type="button"
            onClick={() => pull(item.id)}
            disabled={pending}
            className="text-xs text-accent hover:underline disabled:opacity-50"
          >
            Add
          </button>
        </div>
      ))}

      {callable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
          >
            <option value="">Call in another from Calling Planning&hellip;</option>
            {callable.map((item) => (
              <option key={item.id} value={item.id}>
                {item.personName} -- {item.callingName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => selected && pull(selected)}
            disabled={!selected || pending}
            className="rounded border border-rule px-2 py-1 text-xs text-ink hover:bg-ink/5 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Ward Business, inline in the agenda grid (2026-10-03, the user's own
 * request: "update ward business like we just did the visiting
 * authorities... divided into releases, callings, other"). Replaces
 * the standalone `/meetings/[id]/ward-business` page -- unlike Visiting
 * Authorities, these aren't deferred to the grid's own "Save All
 * Changes": every action here (pulling a Calling Planning item in or
 * out, adding/removing an "Other" item) is a plain button triggering
 * an immediate server action, not a `<form>` submission, so nothing
 * here ever conflicts with the grid's own single big `<form>` either.
 *
 * - **Releases** / **Callings**: never manually typed in directly
 *   anymore (except Presidency Change, folded into Callings' own quick
 *   add -- Calling Planning has no status concept for it) -- always
 *   pulled from Calling Planning, either a "ready to announce"
 *   suggestion or picked from the "call in another" list regardless of
 *   status (the user's own request). Calling Planning stays the single
 *   source of truth for who's being called or released; this is just
 *   another entry point into the same underlying action Calling
 *   Planning's own "Ready to Announce" section already provides.
 * - **Other**: unchanged free-form types (baby blessing, baptism,
 *   mission call, Aaronic Priesthood, new member record) -- same
 *   fields as before, just embedded here instead of on its own page.
 */
export function WardBusinessField({
  meetingId,
  items,
  callableCallings,
  callableReleases,
  people,
  callings,
}: {
  meetingId: string;
  items: RabnmRow[];
  callableCallings: CallableCallingItem[];
  callableReleases: CallableCallingItem[];
  people: PersonOption[];
  callings: CallingOption[];
}) {
  const releaseItems = items.filter((i) => i.type === "release");
  const callingItems = items.filter((i) => i.type === "new_calling" || i.type === "presidency_change");
  const otherItems = items.filter((i) => i.type !== "release" && i.type !== "new_calling" && i.type !== "presidency_change");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">Releases</p>
        {releaseItems.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {releaseItems.map((item) => (
              <ExistingItem key={item.id} item={item} meetingId={meetingId} />
            ))}
          </ul>
        )}
        <CallablePicker meetingId={meetingId} kind="release" items={callableReleases} />
        {releaseItems.length === 0 && callableReleases.length === 0 && (
          <p className="mt-2 text-sm text-ink-muted">Nothing to release right now.</p>
        )}
      </div>

      <div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">Callings</p>
        {callingItems.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {callingItems.map((item) => (
              <ExistingItem key={item.id} item={item} meetingId={meetingId} />
            ))}
          </ul>
        )}
        <CallablePicker meetingId={meetingId} kind="calling" items={callableCallings} />
        <RabnmQuickAddForm
          meetingId={meetingId}
          types={[{ value: "presidency_change", label: "Presidency Change" }]}
          showCalling
          people={people}
          callings={callings}
        />
      </div>

      <div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">Other</p>
        {otherItems.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {otherItems.map((item) => (
              <ExistingItem key={item.id} item={item} meetingId={meetingId} />
            ))}
          </ul>
        )}
        <RabnmQuickAddForm meetingId={meetingId} types={OTHER_TYPES} showCalling={false} people={people} callings={callings} />
      </div>
    </div>
  );
}
