"use client";

import { useState, useTransition, type ReactNode } from "react";
import { deleteRabnmItem } from "@/app/meetings/[id]/planning/actions";
import {
  pullCallingPlanningIntoMeeting,
  removeCallingPlanningFromMeeting,
  pullRabnmPlanningIntoMeeting,
  removeRabnmPlanningFromMeeting,
  moveWardBusinessItem,
  moveWardBusinessSection,
} from "@/app/meetings/[id]/ward-business-actions";
import type { RabnmRow } from "@/lib/data/sacrament-planning";
import type { CallableCallingItem } from "@/lib/data/calling-planning";
import type { CallableRabnmItem, RabnmPlanningType } from "@/lib/data/sacrament-rabnm-planning";
import type { WardBusinessSectionKey } from "@/lib/data/ward-settings";

const SELECT = "rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink";

/** One already-pulled-in row -- Remove reverses the Calling Planning
 *  pull (removeCallingPlanningFromMeeting) when `calling_planning_id`
 *  is set, or falls back to the plain deleteRabnmItem for an older row
 *  predating this rework (a manually-added "Other"/Presidency Change
 *  item from before 2026-10-03, which has no such link).
 *
 * Move Up/Down (2026-10-30, the user's own request: "I would like to
 * be able to re-order individual lines in callings/releases... to the
 * order I would like to have them announced") -- same plain
 * `type="button"` + `useTransition` convention as
 * AgendaElementsManager.tsx's own Up/Down controls, never a real
 * `<form>`, since this row sits inside the bigger agenda grid's own
 * form. `isFirst`/`isLast` disable the button at a boundary, scoped to
 * this row's own list (Releases or Callings reorder independently). */
function ExistingRow({
  item,
  meetingId,
  type,
  isFirst,
  isLast,
}: {
  item: RabnmRow;
  meetingId: string;
  type: "release" | "new_calling";
  isFirst: boolean;
  isLast: boolean;
}) {
  const [removing, startRemove] = useTransition();
  const [moving, startMove] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    setError(null);
    startRemove(async () => {
      const result = item.calling_planning_id
        ? await removeCallingPlanningFromMeeting(meetingId, item.calling_planning_id)
        : await deleteRabnmItem(item.id, meetingId);
      if ("error" in result) setError(result.error);
    });
  };

  const move = (direction: "up" | "down") => {
    setError(null);
    startMove(async () => {
      const result = await moveWardBusinessItem(meetingId, item.id, type, direction);
      if ("error" in result) setError(result.error);
    });
  };

  return (
    <tr className="border-t border-rule/40">
      <td className="py-1.5 pr-3">{item.people.length > 0 ? item.people.map((p) => p.name).join(", ") : "—"}</td>
      <td className="py-1.5 pr-3 text-ink-muted">{item.calling_name ?? "—"}</td>
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
 * Shared heading row for each of Ward Business's subsections (seven
 * since 2026-10-31 -- see WardBusinessField's own doc comment below),
 * with Move Up/Down controls to reorder the SUBSECTIONS themselves
 * (migration 091, the user's own request: "I would like to be able to
 * adjust the order of subsections in the ward business section") --
 * distinct from `ExistingRow`'s own Move Up/Down, which reorders
 * individual LINES within one subsection. Pulled out of each section
 * component so `WardBusinessField` can render the title+controls once,
 * uniformly, for whichever section is in that position.
 */
function SectionHeading({
  title,
  meetingId,
  sectionKey,
  isFirst,
  isLast,
}: {
  title: string;
  meetingId: string;
  sectionKey: WardBusinessSectionKey;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [moving, startMove] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const move = (direction: "up" | "down") => {
    setError(null);
    startMove(async () => {
      const result = await moveWardBusinessSection(meetingId, sectionKey, direction);
      if ("error" in result) setError(result.error);
    });
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">{title}</p>
      <span className="flex items-center gap-2">
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
      </span>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
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
  kind,
  meetingId,
  existing,
  candidates,
}: {
  kind: "calling" | "release";
  meetingId: string;
  existing: RabnmRow[];
  candidates: CallableCallingItem[];
}) {
  const [selected, setSelected] = useState("");
  const [pending, startPull] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sortedCandidates = [...candidates].sort((a, b) => Number(b.ready) - Number(a.ready));
  // sacrament_rabnm.type uses "new_calling", not "calling" -- kind is
  // this component's own (calling | release) prop name, type is the
  // real stored/moved-by value.
  const itemType: "release" | "new_calling" = kind === "release" ? "release" : "new_calling";

  const pull = () => {
    if (!selected) return;
    setError(null);
    startPull(async () => {
      const result = await pullCallingPlanningIntoMeeting(meetingId, selected, kind);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSelected("");
    });
  };

  return (
    <div>
      {existing.length > 0 ? (
        <table className="mt-2 w-full text-sm">
          <tbody>
            {existing.map((item, index) => (
              <ExistingRow
                key={item.id}
                item={item}
                meetingId={meetingId}
                type={itemType}
                isFirst={index === 0}
                isLast={index === existing.length - 1}
              />
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
          {error && <span className="text-[11px] text-danger">{error}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * One of Ward Business's five RABNM-planning subsections (Recognitions/
 * Advancements/Baptisms/New Members/Baby Blessings) -- each its own
 * top-level subsection as of 2026-10-31, the user's own request: "Lets
 * make each individual Recognitions, Advancements, Baptisms, New
 * Members & Baby Blessings their own subsections of ward business
 * instead of sub-subsections under ['Recognitions, Advancements,
 * Baptisms, New Members & Baby Blessings']." Previously all five were
 * bundled into one combined block (`RabnmPlanningSection`, built
 * 2026-10-24) with a single `<optgroup>`-per-category dropdown; now
 * each category gets its own existing-items table and its own plain
 * dropdown, scoped to just that category's own candidates -- no
 * `<optgroup>` needed since there's only ever one category here. The
 * existing-items table drops the old leading "Type" column too, for
 * the same reason -- every row in it is already the same type. The
 * standing pool itself is still managed from its own page,
 * /rabnm-planning -- this is only the pull-into-this-meeting half.
 *
 * Move Up/Down added to each category's own existing items, 2026-10-31
 * (the user's own follow-up request, right after the five-subsection
 * split above shipped) -- same `moveWardBusinessItem` action and same
 * swap-adjacent-sort_order mechanics Releases/Callings' own
 * `ExistingRow` already used, just scoped by this category's own
 * `type` instead of `"release" | "new_calling"`.
 */
function RabnmCategorySection({
  type,
  meetingId,
  existing,
  candidates,
}: {
  type: RabnmPlanningType;
  meetingId: string;
  existing: RabnmRow[];
  candidates: CallableRabnmItem[];
}) {
  const [selected, setSelected] = useState("");
  const [pending, startPull] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pull = () => {
    if (!selected) return;
    setError(null);
    startPull(async () => {
      const result = await pullRabnmPlanningIntoMeeting(meetingId, selected);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSelected("");
    });
  };

  return (
    <div>
      {existing.length > 0 ? (
        <table className="mt-2 w-full text-sm">
          <tbody>
            {existing.map((item, index) => (
              <tr key={item.id} className="border-t border-rule/40 align-top">
                <ExistingRabnmCells
                  item={item}
                  meetingId={meetingId}
                  type={type}
                  isFirst={index === 0}
                  isLast={index === existing.length - 1}
                />
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">None yet.</p>
      )}

      {candidates.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className={SELECT}>
            <option value="">Add&hellip;</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
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

/** A RABNM-planning row's own two <td>s (people + detail, Move Up/
 *  Down + Remove) -- split out on its own so a future caller could
 *  still prepend an extra leading <td> to the same <tr> without
 *  duplicating this logic, the same way the original combined
 *  `RabnmPlanningSection` once did for its own Type column (removed
 *  2026-10-31 once each category became its own subsection and that
 *  column stopped being useful -- every row in one category's table is
 *  already the same type). `RabnmCategorySection` renders this as the
 *  whole row today, with nothing prepended.
 *
 *  Move Up/Down (2026-10-31, the same follow-up request as
 *  `RabnmCategorySection`'s own comment above) -- same
 *  `isFirst`/`isLast`-disables-the-button-at-a-boundary shape as
 *  `ExistingRow`'s identical controls for Releases/Callings. */
function ExistingRabnmCells({
  item,
  meetingId,
  type,
  isFirst,
  isLast,
}: {
  item: RabnmRow;
  meetingId: string;
  type: RabnmPlanningType;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [removing, startRemove] = useTransition();
  const [moving, startMove] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    setError(null);
    startRemove(async () => {
      const result = item.rabnm_planning_id
        ? await removeRabnmPlanningFromMeeting(meetingId, item.rabnm_planning_id)
        : await deleteRabnmItem(item.id, meetingId);
      if ("error" in result) setError(result.error);
    });
  };

  const move = (direction: "up" | "down") => {
    setError(null);
    startMove(async () => {
      const result = await moveWardBusinessItem(meetingId, item.id, type, direction);
      if ("error" in result) setError(result.error);
    });
  };

  return (
    <>
      <td className="py-1.5 pr-3">
        {item.people.length > 0 ? item.people.map((p) => p.name).join(", ") : "—"}
        {item.detail ? ` -- ${item.detail}` : ""}
      </td>
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
    </>
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
 *
 * **Seven subsections, not three, 2026-10-31** (the user's own
 * request: "Lets make each individual Recognitions, Advancements,
 * Baptisms, New Members & Baby Blessings their own subsections of
 * ward business instead of sub-subsections under ['Recognitions,
 * Advancements, Baptisms, New Members & Baby Blessings']") -- the
 * single combined RABNM block added 2026-10-24 (`RabnmPlanningSection`)
 * is gone, replaced by five independent `RabnmCategorySection`
 * instances, one per category, each a real top-level subsection
 * alongside Releases/Callings -- same Move Up/Down subsection-reorder
 * control (`SectionHeading`) as every other subsection here. See
 * ward-settings.ts's own doc comment for how a ward's previously
 * saved subsection order migrates automatically (the old `"rabnm"`
 * entry expands into the five new keys in place).
 */
export function WardBusinessField({
  meetingId,
  items,
  callableCallings,
  callableReleases,
  callableRabnm,
  sectionOrder,
}: {
  meetingId: string;
  items: RabnmRow[];
  callableCallings: CallableCallingItem[];
  callableReleases: CallableCallingItem[];
  callableRabnm: CallableRabnmItem[];
  sectionOrder: WardBusinessSectionKey[];
}) {
  const releaseItems = items.filter((i) => i.type === "release");
  const callingItems = items.filter((i) => i.type === "new_calling");

  // One of Ward Business's five RABNM-planning categories -- splits
  // `items`/`callableRabnm` (both still fetched ward-wide/per-meeting
  // unfiltered, same as before 2026-10-31) down to just this one type.
  const rabnmSection = (type: RabnmPlanningType, title: string) => ({
    title,
    node: (
      <RabnmCategorySection
        type={type}
        meetingId={meetingId}
        existing={items.filter((i) => i.type === type)}
        candidates={callableRabnm.filter((c) => c.type === type)}
      />
    ),
  });

  // One entry per subsection, keyed the same way as WARD_BUSINESS_SECTION_KEYS
  // (ward-settings.ts) -- rendered below in whatever order `sectionOrder`
  // says, each with its own Move Up/Down heading (SectionHeading).
  const sections: Record<WardBusinessSectionKey, { title: string; node: ReactNode }> = {
    release: {
      title: "Releases",
      node: <CallingPlanningSection kind="release" meetingId={meetingId} existing={releaseItems} candidates={callableReleases} />,
    },
    new_calling: {
      title: "Callings",
      node: <CallingPlanningSection kind="calling" meetingId={meetingId} existing={callingItems} candidates={callableCallings} />,
    },
    recognition: rabnmSection("recognition", "Recognitions"),
    advancement: rabnmSection("advancement", "Advancements"),
    baptism: rabnmSection("baptism", "Baptisms"),
    new_member: rabnmSection("new_member", "New Members"),
    baby_blessing: rabnmSection("baby_blessing", "Baby Blessings"),
  };

  return (
    <div className="flex flex-col gap-4">
      {sectionOrder.map((key, index) => (
        <div key={key}>
          <SectionHeading
            title={sections[key].title}
            meetingId={meetingId}
            sectionKey={key}
            isFirst={index === 0}
            isLast={index === sectionOrder.length - 1}
          />
          {sections[key].node}
        </div>
      ))}
    </div>
  );
}
